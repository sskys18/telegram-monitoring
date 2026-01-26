import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import "dotenv/config";

const ROOT = join(import.meta.dir, "..");
const SESSION_FILE = join(ROOT, "session.json");
const CHANNELS_FILE = join(ROOT, "channels.json");

const API_ID = Number(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH!;
const PHONE = process.env.TELEGRAM_PHONE_NUMBER!;
const DEST_GROUP = process.env.DESTINATION_GROUP_ID!;

interface ChannelInfo {
  id: number;
  title: string;
  username: string | null;
}

function toNumber(id: any): number {
  if (id?.toJSNumber) return id.toJSNumber();
  return Number(id);
}

function loadSession(): string {
  if (existsSync(SESSION_FILE)) {
    return JSON.parse(readFileSync(SESSION_FILE, "utf-8")).session;
  }
  return "";
}

function saveSession(session: string) {
  writeFileSync(SESSION_FILE, JSON.stringify({ session }));
}

function loadChannels(): ChannelInfo[] {
  if (existsSync(CHANNELS_FILE)) {
    return JSON.parse(readFileSync(CHANNELS_FILE, "utf-8"));
  }
  return [];
}

function saveChannels(channels: ChannelInfo[]) {
  writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
}

function askInput(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Seed channels.json with all channels if it doesn't exist yet
async function seedChannels(client: TelegramClient): Promise<ChannelInfo[]> {
  const dialogs = await client.getDialogs({});
  const channels: ChannelInfo[] = [];

  for (const dialog of dialogs) {
    // Only broadcast channels (not groups/chats)
    const entity = dialog.entity as any;
    if (dialog.isChannel && entity?.broadcast) {
      channels.push({
        id: toNumber(dialog.id),
        title: dialog.title || "",
        username: entity?.username || null,
      });
    }
  }

  saveChannels(channels);
  console.log(`Seeded channels.json with ${channels.length} channels — edit this file to keep only the ones you want`);
  return channels;
}

async function main() {
  const session = new StringSession(loadSession());
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: PHONE,
    phoneCode: async () => askInput("Enter the code you received: "),
    password: async () => askInput("Enter your 2FA password: "),
    onError: (err) => console.error("Auth error:", err),
  });

  saveSession(client.session.save() as unknown as string);
  console.log("Connected to Telegram");

  // If channels.json doesn't exist, seed it with all channels from Telegram
  if (!existsSync(CHANNELS_FILE)) {
    await seedChannels(client);
    console.log("channels.json created. Edit it to remove channels you don't want to monitor, then restart.");
    await client.disconnect();
    process.exit(0);
  }

  // Load curated channel list
  const channels = loadChannels();
  const channelIds = new Set(channels.map((c) => c.id));
  const channelTitles = new Map(channels.map((c) => [c.id, c.title]));

  // Destination group (can be numeric ID or username)
  const destGroup = DEST_GROUP.match(/^-?\d+$/)
    ? BigInt(DEST_GROUP)
    : DEST_GROUP;

  // Message handler - only forward from channels in channels.json
  async function onNewMessage(event: NewMessageEvent) {
    const msg = event.message;
    const chatId = toNumber(msg.chatId);

    if (!channelIds.has(chatId)) return;

    const title = channelTitles.get(chatId) || "Unknown";
    const preview = (msg.text || "(media)").slice(0, 60).replace(/\n/g, " ");
    console.log(`[${title}] ${preview}`);

    try {
      await client.forwardMessages(destGroup, {
        messages: [msg.id],
        fromPeer: chatId,
      });
    } catch (err: any) {
      if (err?.errorMessage === "CHAT_FORWARDS_RESTRICTED") return;
      console.error(`[ERR] ${title}: ${err?.errorMessage || err}`);
    }
  }

  client.addEventHandler(onNewMessage, new NewMessage({}));
  console.log(`Monitoring ${channels.length} channels, forwarding to ${DEST_GROUP}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nDisconnecting...");
    await client.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(console.error);
