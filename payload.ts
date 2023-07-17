export interface metadataItem {
	event_user_id: number;
	request_type: string;
}

interface webhookPayload {
	subscription_id: number;
	url_callback: string;
	metadata: metadataItem;
	event_id: number;
	creator_id: number;
	created_at: string;
	timestamp: string;
}

export interface PingPayload extends webhookPayload {
    payload: PayloadType.Ping;
    validation_code: string;
    validation_code_url: string;
}

export type WebhookPayload = PingPayload;

export const enum PayloadType {
    Ping = "ping",
}

/**
 * Webhook creation payload
 * {
 *   "event_id": 0,
 *   "created_at": "2023-07-17T10:57:40.959597671Z",
 *   "creator_id": 9547721,
 *   "metadata": {
 *     "request_type": "POST",
 *     "event_user_id": 9547721
 *   },
 *   "payload": "ping",
 *   "subscription_id": 10710,
 *   "timestamp": "2023-07-17T10:57:40.959597671Z",
 *   "url_callback": "https://dark-red-mussel-hose.cyclic.app/new-entry",
 *   "validation_code": "89627dd73f2044f2f73815d665bbce33",
 *   "validation_code_url": "https://track.toggl.com/webhooks/api/v1/validate/7435584/10710/89627dd73f2044f2f73815d665bbce33"
 * }
 */

/**
 * {
 *   "event_id": 8023169274704072,
 *   "created_at": "2023-07-17T11:43:32.827Z",
 *   "creator_id": 9547721,
 *   "metadata": {
 *     "action": "created",
 *     "event_user_id": "9547721",
 *     "model": "time_entry",
 *     "model_owner_id": "9547721",
 *     "path": "/api/v9/workspaces/7435584/time_entries",
 *     "request_body": "{\"at\":\"2023-07-17T11:43:32.445Z\",\"billable\":false,\"description\":\"test\",\"duration\":-1689594212,\"start\":\"2023-07-17T11:43:32.445Z\",\"tags\":[],\"workspace_id\":7435584,\"created_with\":\"TrackExtension/3.0.11\"}",
 *     "request_type": "POST",
 *     "time_entry_id": "3050537739",
 *     "workspace_id": "7435584"
 *   },
 *   "payload": {
 *     "at": "2023-07-17T11:43:32+00:00",
 *     "billable": false,
 *     "description": "test",
 *     "duration": -1689594212,
 *     "duronly": true,
 *     "id": 3050537739,
 *     "project_id": null,
 *     "server_deleted_at": null,
 *     "start": "2023-07-17T11:43:32Z",
 *     "stop": null,
 *     "tag_ids": null,
 *     "tags": [],
 *     "task_id": null,
 *     "uid": 9547721,
 *     "user_id": 9547721,
 *     "wid": 7435584,
 *     "workspace_id": 7435584
 *   },
 *   "subscription_id": 10713,
 *   "timestamp": "2023-07-17T11:43:33.170443406Z",
 *   "url_callback": "https://dark-red-mussel-hose.cyclic.app/new-entry"
 * }
 * @param payload
 */

export function parsePayload(payload: WebhookPayload): CommonPayload {
	return {
		description: '',
		timeInterval: {
			duration: '',
			start: ''
		}
	};
}
