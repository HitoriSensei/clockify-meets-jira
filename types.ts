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
  timeSpent: string;
  description: string;
  started: string;
}
