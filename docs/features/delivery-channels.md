---
title: "Delivery Channels"
category: "feature-reference"
section: "delivery-channels"
route: "/settings"
tags: ["delivery-channels", "slack", "telegram", "webhook", "notifications", "integrations"]
features: ["delivery-channels"]
manual: true
screengrabCount: 0
lastUpdated: "2026-03-31"
---

# Delivery Channels

Delivery Channels let Stagent push notifications and agent output to external services. When a scheduled task fires, completes, or needs attention, Stagent can post a message to Slack, Telegram, or any HTTP endpoint. Channels are configured once in Settings and then attached to individual schedules.

## Key Features

### Channel Types

Three adapter types are supported, each requiring different configuration:

| Type | Config Required | Best For |
|------|----------------|----------|
| **Slack** | Incoming Webhook URL | Team notifications in Slack channels |
| **Telegram** | Bot Token + Chat ID | Personal or group notifications via Telegram bot |
| **Webhook** | URL + optional custom headers | Custom integrations, Zapier, n8n, or any HTTP endpoint |

### Connection Testing

Every channel has a test status indicator:

| Status | Meaning |
|--------|---------|
| **untested** | Channel created but never tested |
| **ok** | Last test message was delivered successfully |
| **failed** | Last test or delivery failed -- check configuration |

Click **Test** next to any channel to send a probe message and update the status. For Slack, the test sends a message reading "Stagent channel test -- connection OK" to the configured channel.

### Enable and Disable

Each channel has an active/disabled toggle. Disabled channels are skipped during delivery but their configuration is preserved. This is useful for temporarily silencing notifications without losing the webhook URL or bot credentials.

### Schedule Integration

When a schedule fires, Stagent checks if it has delivery channels assigned. If so, a notification is posted to each active channel containing:

- The schedule name and firing number
- The task prompt (truncated)
- A link back to the task

Delivery failures are logged but never block task execution -- the agent work completes even if the notification fails to send.

## How To

### Connect Slack to Stagent

This walkthrough creates a Slack App with an Incoming Webhook and connects it to Stagent.

**Part 1 -- Create the Slack App**

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**
3. Enter an App Name (e.g., "Stagent") and select the workspace you want to post to
4. Click **Create App**

**Part 2 -- Enable Incoming Webhooks**

5. In the app settings sidebar, click **Incoming Webhooks**
6. Toggle **Activate Incoming Webhooks** to **On**
7. Scroll down and click **Add New Webhook to Workspace**
8. Select the Slack channel where you want notifications (e.g., `#all-stagent`)
9. Click **Allow** to authorize the webhook
10. Copy the generated **Webhook URL** (starts with `https://hooks.slack.com/services/...`)

**Part 3 -- Add the Channel in Stagent**

11. Open **Settings** in Stagent (sidebar → Configure → Settings)
12. Scroll down to the **Delivery Channels** section
13. Click **+ Add Channel**
14. Set Channel Type to **Slack**
15. Enter a descriptive name (e.g., "Stagent #all-stagent")
16. Paste the Webhook URL from step 10
17. Click **Create Channel**
18. Click **Test** next to the new channel
19. Verify the status changes to green **ok** and check your Slack channel for the test message

### Add a Telegram Channel

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, follow the prompts, and copy the **Bot Token** (format: `123456:ABC-DEF...`)
3. Start a conversation with your new bot (or add it to a group)
4. Get your **Chat ID** by visiting `https://api.telegram.org/bot<TOKEN>/getUpdates` after sending a message -- the `chat.id` field contains the value you need (negative for groups)
5. In Stagent Settings → Delivery Channels → **+ Add Channel**
6. Set Channel Type to **Telegram**
7. Enter the Bot Token and Chat ID
8. Click **Create Channel** → **Test** → verify green **ok**

### Add a Generic Webhook

1. In Stagent Settings → Delivery Channels → **+ Add Channel**
2. Set Channel Type to **Webhook**
3. Enter the destination **URL** (any HTTP endpoint that accepts POST requests)
4. Optionally enter **Custom Headers** as JSON (e.g., `{"Authorization": "Bearer your-token"}`)
5. Click **Create Channel** → **Test** → verify green **ok**

The webhook receives a JSON POST body with this structure:

```json
{
  "subject": "Schedule fired: Daily Report (#5)",
  "body": "Task prompt text...",
  "format": "markdown",
  "metadata": {
    "scheduleId": "...",
    "taskId": "...",
    "firingNumber": 5
  },
  "timestamp": "2026-03-31T10:00:00Z",
  "source": "stagent"
}
```

## Related

- [Settings](./settings.md) -- Delivery Channels live in the Settings page
- [Schedules](./schedules.md) -- Attach channels to schedules for automated notifications
