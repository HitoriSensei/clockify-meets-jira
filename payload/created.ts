

/**
 * {
 * 	"event_id": 8023169274704072,
 * 	"created_at": "2023-07-17T11:43:32.827Z",
 * 	"creator_id": 9547721,
 * 	"metadata": {
 * 		"action": "created",
 * 		"event_user_id": "9547721",
 * 		"model": "time_entry",
 * 		"model_owner_id": "9547721",
 * 		"path": "/api/v9/workspaces/7435584/time_entries",
 * 		"request_body": "{\"at\":\"2023-07-17T11:43:32.445Z\",\"billable\":false,\"description\":\"test\",\"duration\":-1689594212,\"start\":\"2023-07-17T11:43:32.445Z\",\"tags\":[],\"workspace_id\":7435584,\"created_with\":\"TrackExtension/3.0.11\"}",
 * 		"request_type": "POST",
 * 		"time_entry_id": "3050537739",
 * 		"workspace_id": "7435584"
 * 	},
 * 	"payload": {
 * 		"at": "2023-07-17T11:43:32+00:00",
 * 		"billable": false,
 * 		"description": "test",
 * 		"duration": -1689594212,
 * 		"duronly": true,
 * 		"id": 3050537739,
 * 		"project_id": null,
 * 		"server_deleted_at": null,
 * 		"start": "2023-07-17T11:43:32Z",
 * 		"stop": null,
 * 		"tag_ids": null,
 * 		"tags": [],
 * 		"task_id": null,
 * 		"uid": 9547721,
 * 		"user_id": 9547721,
 * 		"wid": 7435584,
 * 		"workspace_id": 7435584
 * 	},
 * 	"subscription_id": 10713,
 * 	"timestamp": "2023-07-17T11:43:33.170443406Z",
 * 	"url_callback": "https://dark-red-mussel-hose.cyclic.app/new-entry"
 * }
 * @param payload
 */

export interface CreatedPayload {
    event_id: number
    created_at: string
    creator_id: number
    metadata: Metadata
    payload: Payload
    subscription_id: number
    timestamp: string
    url_callback: string
}

export interface Metadata {
    action: string
    event_user_id: string
    model: string
    model_owner_id: string
    path: string
    request_body: string
    request_type: string
    time_entry_id: string
    workspace_id: string
}

export interface Payload {
    at: string
    billable: boolean
    description: string
    duration: number
    duronly: boolean
    id: number
    project_id: any
    server_deleted_at: any
    start: string
    stop: any
    tag_ids: any
    tags: any[]
    task_id: any
    uid: number
    user_id: number
    wid: number
    workspace_id: number
}
