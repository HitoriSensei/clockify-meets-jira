interface CommonPayload {
    // {description, timeInterval: {duration, start}}
    description: string;
    timeInterval: {
        duration: string;
        start: string;
    };
}
