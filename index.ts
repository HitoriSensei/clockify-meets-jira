import express, { Request, Response } from "express";
import { config } from "dotenv";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import utc from "dayjs/plugin/utc";
import { isPing, parsePayload, shouldIgnore, WebhookPayload } from "./payload";
import { inspect } from "util";
import { WorkLogData } from "./types";
import { log } from "./log";

import * as jira from "./targets/jira";
import {
  Action,
  LinearDelayStrategy,
  Repeat,
  WithDelayDuration,
  WithDelayStrategy,
  WithMaxRetries,
  WithOnError,
} from "./try";
import { AbortException } from "./exceptions";

dayjs.extend(utc);
dayjs.extend(duration);

config();

const PORT = process.env.PORT;

const app = express();

app.use(express.json());

const authorizationSecret = process.env.AUTHORIZATION_SECRET;
const authorizationHeader = process.env.AUTHORIZATION_HEADER;
const alignTo15Mins = process.env.ALIGN_TO_15_MINS === "true";
const overtimeMultiplier = parseFloat(process.env.OVERTIME_MULTIPLIER || "1.5");
const overtimeToken = process.env.OVERTIME_TOKEN || "[OT]";
const overtimeThreshold = parseFloat(process.env.OVERTIME_THRESHOLD || "8");

const availableTargets = {
  jira: jira.publish,
} as const;

type TargetPublishFunction = (workLogData: WorkLogData) => Promise<void>;

async function queueTarget(
  target: TargetPublishFunction,
  workLogData: WorkLogData
): Promise<void> {
  await Repeat(
    async () => {
      await target(workLogData);
    },
    WithMaxRetries(5),
    WithDelayDuration(1000),
    WithDelayStrategy(LinearDelayStrategy),
    WithOnError((error) => {
      if (error instanceof AbortException) {
        return Action.Abort;
      }
    })
  );
}

async function queueWorkLogData(workLogData: WorkLogData): Promise<boolean> {
  log.info({ workLogData }, "Sending workLog data");

  let targets: TargetPublishFunction[] = [];
  // check if targets are explicitly set in description.
  // format: {target1,target2,target3}
  const targetsInDescription = workLogData.description.match(/{(.*)}/)?.[1];
  if (targetsInDescription) {
    const targetsToCall = targetsInDescription.split(",");
    for (const target of targetsToCall) {
      const cleanTarget = target.trim() as keyof typeof availableTargets;
      if (cleanTarget in availableTargets) {
        targets.push(availableTargets[cleanTarget]);
      } else {
        log.warn({ target: cleanTarget }, "Target not found");
      }
    }

    // remove targets from description
    workLogData.description = workLogData.description
      .replace(/{(.*)}/, "")
      .trim();
  } else {
    // if no targets are set, call all targets
    targets = Object.values(targets);
  }

  for (const target of targets) {
    queueTarget(target, workLogData).catch((err) => {
      log.error({ err, target }, "Error sending workLog data to target");
    });
  }

  return true;
}

async function processRequest(req: express.Request) {
  log.debug(
    { ip: req.ip, body: req.body, headers: req.headers },
    "Incoming request"
  );
  const payload = req.body as WebhookPayload;

  if (isPing(payload)) {
    log.info("Ping received");

    if (payload.validation_code_url) {
      log.info("Sending validation code");
      await fetch(payload.validation_code_url);
    }

    return;
  }

  const ignoreReason = shouldIgnore(payload);
  if (ignoreReason) {
    log.info({ payload, ignoreReason }, "Ignoring entry");
    return;
  }

  const commonPayload = parsePayload(payload);
  const {
    description,
    timeInterval: { duration, start },
  } = commonPayload;

  if (!duration) {
    log.info(payload, "No duration found in payload");
    return;
  }

  log.debug(
    { query: req.query, body: req.body, headers: req.headers },
    "Incoming Clockify request"
  );

  const dayJsDuration = dayjs.duration(duration);

  let timespanInMinutes = dayJsDuration.asMinutes();

  if (alignTo15Mins) {
    const original = timespanInMinutes;
    timespanInMinutes = Math.round(timespanInMinutes / 15) * 15;
    log.info(
      { original: original, rounded: timespanInMinutes },
      "Rounded minutes to nearest 15 minutes"
    );
  }

  if (timespanInMinutes < 1) {
    log.info("Timespan is less than 1 minute, ignoring", duration);
    return;
  }

  const isOvertimeEntry = description.includes(overtimeToken);

  // Handle overtime
  const overtimeThresholdInMinutes = overtimeThreshold * 60;

  if (isOvertimeEntry) {
    log.info(
      "Overtime entry detected, multiplying timespan by overtime multiplier"
    );
    timespanInMinutes = timespanInMinutes * overtimeMultiplier;
  } else if (
    overtimeThresholdInMinutes > 0 &&
    timespanInMinutes > overtimeThresholdInMinutes
  ) {
    // split into two workLogs, one for overtime and one for regular time
    // save the overtime workLog first, then the regular workLog
    const overtimeMinutesMultiplied =
      (timespanInMinutes - overtimeThresholdInMinutes) * overtimeMultiplier;

    const overtimeWorkLogData = {
      description: description.trim() + " " + overtimeToken,
      started: dayjs(start)
        .add(dayjs.duration({ hours: overtimeThreshold }))
        .utc(false)
        .toISOString()
        .replace("Z", "+0000"),
      timeSpent: `${overtimeMinutesMultiplied.toFixed(0)}m`,
      visibility: null,
    };
    log.debug({ overtimeWorkLogData }, "Overtime workLog data");

    await queueWorkLogData(overtimeWorkLogData);

    timespanInMinutes = overtimeThresholdInMinutes;
  }

  // if timespan is NaN, it means the duration was not in a valid format
  if (isNaN(timespanInMinutes)) {
    log.error(
      { parsed: commonPayload, incoming: payload },
      "Could not parse duration"
    );
    return;
  }

  const workLogData = {
    description: description.trim(),
    started: dayjs(start).utc(false).toISOString().replace("Z", "+0000"),
    timeSpent: `${timespanInMinutes.toFixed(0)}m`,
    visibility: null,
  };

  await queueWorkLogData(workLogData);
}

app
  .post("/new-entry", async (req: Request, res: Response) => {
    if (authorizationHeader && authorizationSecret) {
      const incomingSecret = req.headers[
        authorizationHeader.toLowerCase()
      ] as string;
      if (incomingSecret !== authorizationSecret) {
        log.error({ incomingSecret }, "Authorization secrets do not match");
        return res.status(401).send("Unauthorized");
      }
    }

    try {
      await processRequest(req);

      res.status(200).send("Ok");
    } catch (error) {
      log.error({ error: inspect(error) }, "Caught error");
    }
  })
  .listen(PORT, () => log.info(`Listening on ${PORT}`));
