---
title: "Delivery Channels"
category: "feature-reference"
section: "delivery-channels"
route: "/settings"
tags: ["delivery-channels", "slack", "telegram", "webhook", "notifications", "integrations", "bidirectional", "chat"]
features: ["delivery-channels", "bidirectional-channel-chat"]
manual: true
screengrabCount: 0
lastUpdated: "2026-04-01"
---

# Delivery Channels

Delivery Channels connect Stagent to external messaging services. Channels support two modes:

- **Outbound** -- Stagent pushes notifications when scheduled tasks fire, complete, or need attention
- **Bidirectional (Chat)** -- Users can chat with Stagent agents directly from Slack or Telegram, and receive responses in the same conversation

Channels are configured in Settings and can be toggled between outbound-only and bidirectional mode at any time.

## Key Features

### Channel Types

Three adapter types are supported, each requiring different configuration:

| Type | Outbound Config | Bidirectional Config | Best For |
|------|----------------|---------------------|----------|
| **Slack** | Incoming Webhook URL | + Bot Token, Signing Secret, Channel ID | Team chat and notifications |
| **Telegram** | Bot Token + Chat ID | Same (no extra config needed) | Personal AI assistant via messaging |
| **Webhook** | URL + optional headers | N/A (outbound only) | Custom integrations, Zapier, n8n |

### Bidirectional Chat

When Chat mode is enabled on a Slack or Telegram channel, you can message Stagent directly from your messaging app. Stagent processes your message through the same chat engine used in the web UI, including:

- **Multi-turn conversations** -- context is maintained across messages
- **Tool access** -- the agent can query projects, tasks, documents, schedules, and more
- **Permission handling** -- if a tool requires approval, Stagent asks in the channel and you reply with "approve" or "deny"
- **Turn locking** -- if you send a message while the agent is still processing, you get a "Still processing, please wait..." reply

Channel conversations also appear in the Stagent Chat sidebar, so you can continue them from the web UI.

### Connection Testing

Every channel has a test status indicator:

| Status | Meaning |
|--------|---------|
| **untested** | Channel created but never tested |
| **ok** | Last test message was delivered successfully |
| **failed** | Last test or delivery failed -- check configuration |

Click **Test** next to any channel to send a probe message and update the status.

### Channel Controls

Each channel card in Settings has:

- **Chat** toggle -- enable/disable bidirectional chat mode (Slack and Telegram only)
- **Active** toggle -- enable/disable the channel entirely (preserves configuration)
- **Test** button -- send a test message to verify connectivity
- **Delete** button -- remove the channel

When Chat is enabled, a webhook URL is displayed below the channel card for reference.

### Schedule Integration

When a schedule fires, Stagent checks if it has delivery channels assigned. If so, a notification is posted to each active channel containing:

- The schedule name and firing number
- The task prompt (truncated)
- A link back to the task

Delivery failures are logged but never block task execution -- the agent work completes even if the notification fails to send.

### Auto-Polling (Local Development)

For local development, Stagent includes a built-in poller that checks Telegram and Slack for new messages every 5 seconds. This runs automatically when the dev server starts -- no public URL or webhook registration needed. The poller only polls channels that have both Chat enabled and Active status on.

## How To

### Connect Slack to Stagent

This walkthrough creates a Slack App and connects it to Stagent for both outbound notifications and bidirectional chat.

**Part 1 -- Create the Slack App**

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**
3. Enter an App Name (e.g., "Stagent") and select the workspace you want to post to
4. Click **Create App**

**Part 2 -- Enable Incoming Webhooks (for outbound notifications)**

5. In the app settings sidebar, click **Incoming Webhooks**
6. Toggle **Activate Incoming Webhooks** to **On**
7. Scroll down and click **Add New Webhook to Workspace**
8. Select the Slack channel where you want notifications (e.g., `#all-stagent`)
9. Click **Allow** to authorize the webhook
10. Copy the generated **Webhook URL** (starts with `https://hooks.slack.com/services/...`)

**Part 3 -- Add Bot Scopes (for bidirectional chat)**

11. In the app settings sidebar, click **OAuth & Permissions**
12. Scroll down to **Bot Token Scopes**
13. Click **Add an OAuth Scope** and add these scopes:
    - `channels:history` -- read messages from public channels
    - `chat:write` -- send messages as the bot
14. Scroll up and click **Reinstall to Stagent** to apply the new scopes
15. Copy the **Bot User OAuth Token** (starts with `xoxb-...`)

**Part 4 -- Get the Channel ID**

16. Open Slack in a browser and navigate to the target channel
17. The Channel ID is in the URL: `app.slack.com/client/WORKSPACE_ID/CHANNEL_ID` -- copy the `CHANNEL_ID` (starts with `C`)

**Part 5 -- Add the Channel in Stagent**

18. Open **Settings** in Stagent (sidebar → Configure → Settings)
19. Scroll down to the **Delivery Channels** section
20. Click **+ Add Channel**
21. Set Channel Type to **Slack**
22. Enter a descriptive name (e.g., "Stagent #all-stagent")
23. Paste the **Webhook URL** from step 10
24. Paste the **Bot Token** from step 15
25. Optionally paste the **Signing Secret** (from Basic Information → App Credentials)
26. Paste the **Channel ID** from step 17
27. Click **Create Channel**
28. Click **Test** -- verify the status changes to green **ok**
29. Toggle **Chat** on to enable bidirectional mode
30. Send a message in the Slack channel mentioning @Stagent -- you should receive a response within seconds

### Add a Telegram Channel

**Part 1 -- Create the Bot**

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, follow the prompts, and copy the **Bot Token** (format: `123456:ABC-DEF...`)
3. Search for your bot by its username and **send it any message** (e.g., "hello") -- this is required before you can retrieve your Chat ID
4. Get your **Chat ID** by visiting `https://api.telegram.org/bot<TOKEN>/getUpdates` in your browser -- the `chat.id` field in the JSON response contains the value you need (negative for groups). If the result array is empty, send another message to the bot first, then reload the URL

**Part 2 -- Add the Channel in Stagent**

5. In Stagent Settings → Delivery Channels → **+ Add Channel**
6. Set Channel Type to **Telegram**
7. Enter the Bot Token and Chat ID
8. Click **Create Channel**
9. Click **Test** -- verify the status changes to green **ok**
10. Open the bot conversation in Telegram and confirm the test message was delivered
11. Toggle **Chat** on to enable bidirectional mode
12. Send a message to your bot in Telegram -- you should receive a response within seconds

### Add a Generic Webhook

1. In Stagent Settings → Delivery Channels → **+ Add Channel**
2. Set Channel Type to **Webhook**
3. Enter the destination **URL** (any HTTP endpoint that accepts POST requests)
4. Optionally enter **Custom Headers** as JSON (e.g., `{"Authorization": "Bearer your-token"}`)
5. Click **Create Channel** → **Test** → verify green **ok**

Webhooks are outbound-only. The webhook receives a JSON POST body with this structure:

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

### Enable or Disable Bidirectional Chat

To toggle Chat mode on an existing channel:

1. Go to Settings → Delivery Channels
2. Find the channel card for Slack or Telegram
3. Toggle the **Chat** switch on or off
4. When Chat is on, the channel shows a blue "Chat" badge and displays the webhook URL
5. The auto-poller starts/stops polling that channel within 5 seconds

### Conversations from Channels

Channel conversations appear in the **Chat** sidebar alongside regular conversations. They are titled "Channel: [channel name]" and use the Sonnet model by default. You can view and continue these conversations from the web UI as well.

## Related

- [Settings](./settings.md) -- Delivery Channels live in the Settings page
- [Schedules](./schedules.md) -- Attach channels to schedules for automated notifications
- [Chat](./chat.md) -- Channel conversations appear in the Chat sidebar
