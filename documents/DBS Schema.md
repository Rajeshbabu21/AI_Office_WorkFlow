## Table `users`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `full_name` | `varchar` |  |
| `email` | `varchar` |  Unique |
| `employee_id` | `varchar` |  Unique |
| `department` | `varchar` |  Nullable |
| `role` | `varchar` |  |
| `password_hash` | `text` |  |
| `created_at` | `timestamp` |  Nullable |

## Table `tickets`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `user_id` | `int4` |  |
| `title` | `varchar` |  |
| `description` | `text` |  |
| `category` | `varchar` |  Nullable |
| `priority` | `varchar` |  Nullable |
| `status` | `varchar` |  Nullable |
| `assigned_to` | `int4` |  Nullable |
| `created_at` | `timestamp` |  Nullable |
| `updated_at` | `timestamp` |  Nullable |
| `department` | `varchar` |  Nullable |
| `ai_response` | `text` |  Nullable |

## Table `ticket_messages`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `ticket_id` | `int4` |  |
| `sender_id` | `int4` |  |
| `message` | `text` |  |
| `created_at` | `timestamp` |  Nullable |

## Table `ticket_history`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `ticket_id` | `int4` |  |
| `action` | `varchar` |  |
| `performed_by` | `int4` |  Nullable |
| `created_at` | `timestamp` |  Nullable |

## Table `sop_documents`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `title` | `varchar` |  |
| `department` | `varchar` |  Nullable |
| `file_url` | `text` |  |
| `uploaded_by` | `int4` |  Nullable |
| `uploaded_at` | `timestamp` |  Nullable |

## Table `sop_chunks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `sop_id` | `int4` |  |
| `chunk_text` | `text` |  |
| `created_at` | `timestamp` |  Nullable |
| `embedding` | `vector` |  Nullable |

## Table `ai_classifications`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `ticket_id` | `int4` |  |
| `category` | `varchar` |  Nullable |
| `priority` | `varchar` |  Nullable |
| `sentiment` | `varchar` |  Nullable |
| `confidence` | `numeric` |  Nullable |
| `created_at` | `timestamp` |  Nullable |

## Table `escalations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `ticket_id` | `int4` |  |
| `escalated_to` | `varchar` |  Nullable |
| `reason` | `text` |  Nullable |
| `escalated_at` | `timestamp` |  Nullable |

## Table `email_logs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int4` | Primary |
| `ticket_id` | `int4` |  Nullable |
| `recipient_email` | `varchar` |  Nullable |
| `subject` | `varchar` |  Nullable |
| `sent_at` | `timestamp` |  Nullable |
| `user_id` | `int8` |  Nullable |
| `email_body` | `text` |  Nullable |
| `email_type` | `text` |  Nullable |
| `status` | `text` |  Nullable |
| `error_message` | `text` |  Nullable |



