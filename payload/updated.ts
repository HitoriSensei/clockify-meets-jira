// {
//     "event_id": 8256404788549451,
//     "created_at": "2023-08-22T12:43:35.731Z",
//     "creator_id": 9547721,
//     "metadata": {
//     "action": "updated",
//         "event_user_id": "9547721",
//         "model": "time_entry",
//         "model_owner_id": "9547721",
//         "path": "/api/v9/workspaces/7435584/time_entries/3095646709",
//         "request_body": "{\"id\":3095646709,\"workspace_id\":7435584,\"project_id\":null,\"task_id\":null,\"billable\":false,\"start\":\"2023-08-22T11:50:51+00:00\",\"duration\":3001,\"description\":\"C2C-2 !!\",\"tags\":[],\"duronly\":true,\"at\":\"2023-08-22T12:40:52+00:00\",\"server_deleted_at\":null,\"user_id\":9547721}",
//         "request_type": "PUT",
//         "time_entry_id": "3095646709",
//         "workspace_id": "7435584"
// },
//     "payload": {
//     "at": "2023-08-22T12:43:35+00:00",
//         "billable": false,
//         "description": "C2C-2 !!",
//         "duration": 3001,
//         "duronly": true,
//         "id": 3095646709,
//         "project_id": null,
//         "server_deleted_at": null,
//         "start": "2023-08-22T11:50:51Z",
//         "stop": "2023-08-22T12:40:52Z",
//         "tag_ids": null,
//         "tags": [],
//         "task_id": null,
//         "uid": 9547721,
//         "user_id": 9547721,
//         "wid": 7435584,
//         "workspace_id": 7435584
// },
//     "subscription_id": 10713,
//     "timestamp": "2023-08-22T12:43:36.353083349Z",
//     "url_callback": "https://dark-red-mussel-hose.cyclic.app/new-entry"
// }

export interface UpdatedPayload {
  event_id: number;
  created_at: string;
  creator_id: number;
  metadata: {
    action: "updated";
    event_user_id: string;
    model: "time_entry";
    model_owner_id: string;
    path: string;
    request_body: string;
    request_type: string;
    time_entry_id: string;
    workspace_id: string;
  };
  payload: {
    at: string;
    billable: boolean;
    description: string;
    duration: number;
    duronly: boolean;
    id: number;
    project_id: null;
    server_deleted_at: null;
    start: string;
    stop: string;
    tag_ids: null;
    tags?: string[];
    task_id: null;
    uid: number;
    user_id: number;
    wid: number;
    workspace_id: number;
  };
  subscription_id: number;
  timestamp: string;
  url_callback: string;
}
