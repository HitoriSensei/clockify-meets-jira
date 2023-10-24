import { WorkLogData } from "../types";
import { BASIC, buildAuthorizationHeader } from "http-auth-utils";
import { log as rootLog } from "../log";
import { AbortException } from "../exceptions";

const jiraURL = process.env.JIRA_URL;
const jiraUsername = process.env.JIRA_USERNAME;
const jiraToken = process.env.JIRA_TOKEN;

const log = rootLog.child({ target: "jira" });

export async function publish(workLogData: WorkLogData): Promise<void> {
  if (!jiraURL || !jiraUsername || !jiraToken) {
    throw new AbortException("Jira not configured");
  }

  const description = workLogData.description;

  // find jira issue ID in the description
  const issueID = description.match(/([A-Z0-9]+-\d+)/i)?.[0];
  if (!issueID) {
    throw new AbortException("No issue ID found in description");
  }

  const issues = await fetch(
    jiraURL + "/rest/api/2/search?jql=" + encodeURIComponent(`id=${issueID}`),
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
  ).then(
    (res) =>
      res.json() as Promise<{
        issues?: {
          id: number;
          key: string;
        }[];
      }>
  );

  const issue = issues.issues?.[0];

  if (!issue) {
    throw new Error(`Could not find issue with ID ${issueID}`);
  }

  log.info({ id: issue.id, key: issue.key }, "Found issue");

  const update = await fetch(
    `${jiraURL}/rest/api/2/issue/${
      issue.key
    }/workLog?adjustEstimate=auto&_r=${Date.now()}`,
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: buildAuthorizationHeader(BASIC, {
          username: jiraUsername,
          password: jiraToken,
        }),
      },
      body: JSON.stringify(workLogData),
      method: "POST",
    }
  );

  if (update.status !== 201) {
    log.error(
      { status: update.status, body: await update.text() },
      "Could not update workLog"
    );

    throw new Error("Could not update workLog");
  }

  log.info(
    {
      key: issue.key,
      duration: workLogData.timeSpent,
      date: workLogData.started,
    },
    "Updated workLog"
  );

  return;
}
