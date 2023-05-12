import express, { Request, Response } from "express";
import { config } from "dotenv";
import { BASIC, buildAuthorizationHeader } from 'http-auth-utils'
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import utc from "dayjs/plugin/utc";
import pino from 'pino'

dayjs.extend(utc)
dayjs.extend(duration)

config()

const PORT = process.env.PORT

let app = express();

app.use(express.json());

const log = pino({
    level: process.env.LOG_LEVEL || 'info',
})

let jiraURL = process.env.JIRA_URL;
let jiraUsername = process.env.JIRA_USERNAME;
let jiraToken = process.env.JIRA_TOKEN;
let clockifySecret = process.env.CLOCKIFY_SECRET;
let alignTo15Mins = process.env.ALIGN_TO_15_MINS === 'true';
let overtimeMultiplier = parseFloat(process.env.OVERTIME_MULTIPLIER || '1.5');
let overtimeToken = process.env.OVERTIME_TOKEN || '*'
let overtimeThreshold = parseFloat(process.env.OVERTIME_THRESHOLD || '8');

async function queueWorklogData(worklogData: {
    visibility: null;
    timeSpent: string;
    comment: string;
    started: string
}, issue: { id: number; key: string }): Promise<boolean> {
    log.debug({worklogData}, "Sending worklog data")

    const update = await fetch(`${jiraURL}/rest/api/2/issue/${issue.key}/worklog?adjustEstimate=auto&_r=${Date.now()}`, {
        "headers": {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': buildAuthorizationHeader(BASIC, {
                username: jiraUsername,
                password: jiraToken
            })
        },
        "body": JSON.stringify(worklogData),
        "method": "POST"
    })

    if (update.status !== 201) {
        log.error({status: update.status, body: await update.text()}, "Could not update worklog");

        // wait 5 seconds and try again
        await new Promise(resolve => setTimeout(resolve, 5000));
        return await queueWorklogData(worklogData, issue);
    }

    log.info({key: issue.key, duration: worklogData.timeSpent, date: worklogData.started}, "Updated worklog");
    return true
}

app
    .post('/new-entry', async (req: Request, res: Response) => {
        try {
            log.debug({ ip: req.ip }, "New request");
            const {description, timeInterval: {duration, start}} = req.body as {
                description: string,
                timeInterval: { duration: string, start: string }
            };

            const incomingSecret = req.headers['clockify-signature'] as string;
            if (incomingSecret !== clockifySecret) {
                log.error({incomingSecret}, "Clockify secrets do not match")
                return res.status(400).send("Secrets do not match");
            }

            // find jira issue ID in the description
            const issueID = description.match(/([A-Z0-9]+-\d+)/i)?.[0];
            if (!issueID) {
                log.warn({description}, "No issue ID found in description")
                return res.status(200).send("No issue ID found in description");
            }

            log.debug({query: req.query, body: req.body, headers: req.headers}, "Incoming Clockify request")

            const issues = await fetch(
                jiraURL + '/rest/api/2/search?jql=' + encodeURIComponent(`id=${issueID}`),
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': buildAuthorizationHeader(BASIC, {
                            username: jiraUsername,
                            password: jiraToken
                        })
                    }
                }
            ).then(res => res.json());

            const issue = issues.issues[0] as {
                id: number,
                key: string
            };
            if (!issue) {
                log.warn({issueID}, "No issue found for ID")
                return res.status(200).send("No issue found for ID");
            }

            log.info({id: issue.id, key: issue.key}, "Found issue");

            let dayJsDuration = dayjs.duration(duration);

            let timespanInMinutes = dayJsDuration.asMinutes();


            if (alignTo15Mins) {
                const original = timespanInMinutes
                timespanInMinutes = Math.round(timespanInMinutes / 15) * 15;
                log.info({ original: original, rounded: timespanInMinutes},"Rounded minutes to nearest 15 minutes");
            }

            if (timespanInMinutes < 1) {
                log.info("Timespan is less than 1 minute, ignoring", duration)
                return res.status(200).send("Timespan is less than 1 minute");
            }

            // everything is OK, send 200 OK to Clockify and queue the worklog
            res.status(200).send("OK");

            const isOvertimeEntry = description.includes(overtimeToken);

            // Handle overtime
            let overtimeThresholdInMinutes = overtimeThreshold * 60;

            if (isOvertimeEntry) {
                log.info("Overtime entry detected, multiplying timespan by overtime multiplier")
                timespanInMinutes = timespanInMinutes * overtimeMultiplier;
            } else if (timespanInMinutes > overtimeThresholdInMinutes) {
                // split into two worklogs, one for overtime and one for regular time
                // save the overtime worklog first, then the regular worklog
                let overtimeMinutesMultiplied = (timespanInMinutes - overtimeThresholdInMinutes) * overtimeMultiplier;

                const overtimeWorklogData = {
                    "comment": description.replace(issueID, "").trim() + " " + overtimeToken,
                    "started": dayjs(start).add(dayjs.duration({hours: overtimeThreshold})).utc(false).toISOString().replace('Z', '+0000'),
                    "timeSpent": `${overtimeMinutesMultiplied.toFixed(0)}m`,
                    "visibility": null
                }
                log.debug({overtimeWorklogData}, "Overtime worklog data")

                await queueWorklogData(overtimeWorklogData, issue);

                timespanInMinutes = overtimeThresholdInMinutes;
            }

            const worklogData = {
                "comment": description.replace(issueID, "").trim(),
                "started": dayjs(start).utc(false).toISOString().replace('Z', '+0000'),
                "timeSpent": `${timespanInMinutes.toFixed(0)}m`,
                "visibility": null
            };

            await queueWorklogData(worklogData, issue);
        } catch (error) {
            log.error({error}, "Caught error")
            if(!res.headersSent) {
                res.status(500).send("Server error");
            }
            return
        }
    })
    .listen(PORT, () => log.info(`Listening on ${PORT}`))
