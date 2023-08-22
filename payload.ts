import { PingPayload } from "./payload/ping";
import { CreatedPayload } from "./payload/created";

export type WebhookPayload = PingPayload | CreatedPayload | UpdatedPayload;

export function isPing(payload: WebhookPayload): payload is PingPayload {
	return payload.payload == "ping";
}

export function isCreated(payload: WebhookPayload): payload is CreatedPayload {
	return typeof payload.metadata === "object" && "action" in payload.metadata && payload.metadata.action === "created";
}

export type CommonPayload = {
	description: string;
	timeInterval: {
		duration: string;
		start: string;
		end: string;
	}
}

const noop: CommonPayload = {
	description: '',
	timeInterval: {
		duration: '',
		start: '',
		end: ''
	}
};

export function isUpdated(payload: WebhookPayload): payload is UpdatedPayload {
	return typeof payload.metadata === "object" && "action" in payload.metadata && payload.metadata.action === "updated";
}

export function isDeleted(payload: WebhookPayload): payload is UpdatedPayload {
	return isUpdated(payload) && payload.metadata.request_body.includes('\\"deleted_at\\"');
}

export function shouldIgnore(payload: WebhookPayload): string | false {
	return (isPing(payload) && "Ping received")
		|| (isCreated(payload) && !payload.payload.stop && "Created entry without stop time")
		|| (isUpdated(payload) && !payload.payload.stop && "Updated entry without stop time")
		|| (isDeleted(payload) && "Deleted entry")
		|| false;
}

export function parsePayload(payload: WebhookPayload): CommonPayload {
	if (isPing(payload)) {
		return noop;
	}

	if (isUpdated(payload)) {
		return {
			description: payload.payload.description,
			timeInterval: {
				duration: `PT${payload.payload.duration.toString()}S`,
				start: payload.payload.start,
				end: payload.payload.stop
			}
		};
	}

	return noop
}
