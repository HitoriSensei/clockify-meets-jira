import { WorkLogData } from "../types";
import { BASIC, buildAuthorizationHeader } from "http-auth-utils";
import { log as rootLog } from "../log";
import { AbortException } from "../exceptions";

const jiraURL = process.env.JIRA_URL;
const jiraUsername = process.env.JIRA_USERNAME;
const jiraToken = process.env.JIRA_TOKEN;

const log = rootLog.child({ target: "jira" });

type JiraWorkLogData = {
  visibility: null;
  timeSpent: string;
  comment: string;
  started: string;
};

export async function publish(workLogData: WorkLogData): Promise<void> {
  if (!jiraURL || !jiraUsername || !jiraToken) {
    throw new AbortException("Jira not configured");
  }

  // find jira issue ID in the description
  const issueID = workLogData.description.match(/([A-Z0-9]+-\d+)/i)?.[0];
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
    throw new AbortException(`Could not find issue with ID ${issueID}`);
  }

  log.info({ id: issue.id, key: issue.key }, "Found issue");

  const jiraWorkLogData: JiraWorkLogData = {
    visibility: null,
    timeSpent: `${workLogData.timeSpentInMinutes.toFixed(0)}m`,
    comment: workLogData.description.replace(issue.key, "").trim(),
    started: workLogData.started.toISOString().replace("Z", "+0000"),
  };

  log.debug({ jiraWorkLogData }, "Jira workLog data");

  const url = `${jiraURL}/rest/api/2/issue/${
    issue.key
  }/workLog?adjustEstimate=auto&_r=${Date.now()}`;

  log.debug({ url }, "Jira workLog url");

  const update = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: buildAuthorizationHeader(BASIC, {
        username: jiraUsername,
        password: jiraToken,
      }),
    },
    body: JSON.stringify(jiraWorkLogData),
    method: "POST",
  });

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
      duration: workLogData.timeSpentInMinutes,
      date: workLogData.started,
    },
    "Updated workLog"
  );

  return;
}
