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

export interface PingPayload {
    event_id: number
    created_at: string
    creator_id: number
    metadata: Metadata
    payload: string
    subscription_id: number
    timestamp: string
    url_callback: string
    validation_code: string
    validation_code_url: string
}

export interface Metadata {
    request_type: string
    event_user_id: number
}
