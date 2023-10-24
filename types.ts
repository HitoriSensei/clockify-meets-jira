import dayjs from "dayjs";

export interface CommonPayload {
  // {description, timeInterval: {duration, start}}
  description: string;
  timeInterval: {
    duration: string;
    start: string;
  };
}

export interface WorkLogData {
  visibility: null;
  timeSpentInMinutes: number;
  description: string;
  started: dayjs.Dayjs;
}
