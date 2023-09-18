import express, { Request, Response } from "express";
import { config } from "dotenv";
import { BASIC, buildAuthorizationHeader } from "http-auth-utils";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import utc from "dayjs/plugin/utc";
import pino from "pino";
import { isPing, parsePayload, shouldIgnore, WebhookPayload } from "./payload";
import { inspect } from "util";

dayjs.extend(utc);
dayjs.extend(duration);

config();

const PORT = process.env.PORT;

const app = express();

app.use(express.json());

const log = pino({
  level: process.env.LOG_LEVEL || "info",
});

const jiraURL = process.env.JIRA_URL;
const jiraUsername = process.env.JIRA_USERNAME;
const jiraToken = process.env.JIRA_TOKEN;
const authorizationSecret = process.env.AUTHORIZATION_SECRET;
const authorizationHeader = process.env.AUTHORIZATION_HEADER;
const alignTo15Mins = process.env.ALIGN_TO_15_MINS === "true";
const overtimeMultiplier = parseFloat(process.env.OVERTIME_MULTIPLIER || "1.5");
const overtimeToken = process.env.OVERTIME_TOKEN || "[OT]";
const overtimeThreshold = parseFloat(process.env.OVERTIME_THRESHOLD || "8");

async function queueWorklogData(
  worklogData: {
    visibility: null;
    timeSpent: string;
    comment: string;
    started: string;
  },
  issue: { id: number; key: string },
  count = 0
): Promise<boolean> {
  log.info({ worklogData }, "Sending worklog data");

  const update = await fetch(
    `${jiraURL}/rest/api/2/issue/${
      issue.key
    }/worklog?adjustEstimate=auto&_r=${Date.now()}`,
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: buildAuthorizationHeader(BASIC, {
          username: jiraUsername,
          password: jiraToken,
        }),
      },
      body: JSON.stringify(worklogData),
      method: "POST",
    }
  );

  if (update.status !== 201) {
    log.error(
      { status: update.status, body: await update.text() },
      "Could not update worklog"
    );

    if (count < 5) {
      // wait 1 seconds and try again
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return await queueWorklogData(worklogData, issue, count + 1);
    } else {
      throw new Error(
        `Could not update worklog: returned status ${update.status}`
      );
    }
  }

  log.info(
    {
      key: issue.key,
      duration: worklogData.timeSpent,
      date: worklogData.started,
    },
    "Updated worklog"
  );
  return true;
}

function retry<T>(
  generator: (count: number) => Promise<T>,
  amount: number,
  delay: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = (count: number) => {
      generator(count)
        .then(resolve)
        .catch((err) => {
          if (count < amount) {
            setTimeout(() => run(count + 1), delay);
          } else {
            reject(err);
          }
        });
    };
    run(0);
  });
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
    log.info({ description }, "No duration found in payload");
    return;
  }

  // find jira issue ID in the description
  const issueID = description.match(/([A-Z0-9]+-\d+)/i)?.[0];
  if (!issueID) {
    log.warn({ description }, "No issue ID found in description");
    return;
  }

  log.debug(
    { query: req.query, body: req.body, headers: req.headers },
    "Incoming Clockify request"
  );

  const issues = await retry(
    async (): Promise<{ issues: { id: number }[] }> =>
      await fetch(
        jiraURL +
          "/rest/api/2/search?jql=" +
          encodeURIComponent(`id=${issueID}`),
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: buildAuthorizationHeader(BASIC, {
              username: jiraUsername,
              password: jiraToken,
            }),
          },
        }
      ).then((res) => res.json()),
    5,
    1000
  ).catch((err) => {
    log.error({ err }, "Error fetching issues");
    return { issues: [] };
  });

  const issue = issues.issues[0] as {
    id: number;
    key: string;
  };
  if (!issue) {
    log.warn({ issueID }, "No issue found for ID");
    return;
  }

  log.info({ id: issue.id, key: issue.key }, "Found issue");

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
    // split into two worklogs, one for overtime and one for regular time
    // save the overtime worklog first, then the regular worklog
    const overtimeMinutesMultiplied =
      (timespanInMinutes - overtimeThresholdInMinutes) * overtimeMultiplier;

    const overtimeWorklogData = {
      comment: description.replace(issueID, "").trim() + " " + overtimeToken,
      started: dayjs(start)
        .add(dayjs.duration({ hours: overtimeThreshold }))
        .utc(false)
        .toISOString()
        .replace("Z", "+0000"),
      timeSpent: `${overtimeMinutesMultiplied.toFixed(0)}m`,
      visibility: null,
    };
    log.debug({ overtimeWorklogData }, "Overtime worklog data");

    await queueWorklogData(overtimeWorklogData, issue);

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

  const worklogData = {
    comment: description.replace(issueID, "").trim(),
    started: dayjs(start).utc(false).toISOString().replace("Z", "+0000"),
    timeSpent: `${timespanInMinutes.toFixed(0)}m`,
    visibility: null,
  };

  await queueWorklogData(worklogData, issue);
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
