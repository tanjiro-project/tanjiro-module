import { REST } from "@discordjs/rest";
import { PrismaClient } from "@prisma/client";
import { container, Piece, Store, StoreRegistry } from "@sapphire/pieces";
import EventEmitter from "node:events";
import pino from "pino";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { Util } from "../Utilities/Util.js";
import { APIUser, GatewayDispatchEvents } from "discord-api-types/v10";
import redis from "ioredis";
import { CommonEvents } from "../Utilities/Enums/CommonEvents.js";
import { ListenerStore } from "../Stores/ListenerStore.js";
import { createAmqp, RoutingSubscriber } from "@nezuchan/cordis-brokers";
import { Constants } from "../Utilities/Constants.js";

export class TanjiroClient extends EventEmitter {
    public rest = new REST();
    public prisma = new PrismaClient({ rejectOnNotFound: false });

    public user: APIUser | null = null;
    public totalShards!: number;
    public stores = new StoreRegistry();

    public amqpTwilightReceiver!: RoutingSubscriber<string, Record<string, any>>;

    public logger = pino({
        name: "tanjiro-module",
        timestamp: true,
        level: process.env.NODE_ENV === "production" ? "info" : "trace",
        formatters: {
            bindings: () => ({
                pid: "Tanjiro Module"
            })
        },
        transport: {
            targets: [
                { target: "pino/file", level: "info", options: { destination: resolve(process.cwd(), "logs", `nezu-${this.date()}.log`) } },
                { target: "pino-pretty", level: process.env.NODE_ENV === "production" ? "info" : "trace", options: { translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l o" } }
            ]
        }
    });

    public redis = new redis(Number(process.env.REDIS_PORT), process.env.REDIS_HOST!, {
        password: process.env.REDIS_PASSWORD,
        db: Number(process.env.REDIS_DB_INDEX ?? 0)
    });

    public date(): string {
        return Util.formatDate(Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour12: false
        }));
    }

    public async iniitalize(): Promise<boolean> {
        this.rest.setToken(process.env.DISCORD_TOKEN!);
        await this.intializeAmqp();
        await this.initializeStores();
        const rawBot = await this.redis.get("bot_user");
        const shards = await this.redis.get("gateway_shards");
        if (rawBot && shards) {
            this.user = JSON.parse(rawBot);
            this.totalShards = Number(shards);
            return this.emit(CommonEvents.Ready, this);
        }
        return Promise.reject(new Error("Failed to fetch bot user from redis"));
    }

    public async intializeAmqp(): Promise<void> {
        const { channel } = await createAmqp(process.env.AMQP_HOST!);
        this.amqpTwilightReceiver = new RoutingSubscriber(channel);
        await this.amqpTwilightReceiver.init({
            name: Constants.GATEWAY,
            durable: true,
            exchangeType: "topic",
            useExchangeBinding: true,
            keys: [
                GatewayDispatchEvents.MessageCreate
            ]
        });
    }

    public async initializeStores(): Promise<void> {
        container.client = this;
        this.stores.register(new ListenerStore());
        this.stores.registerPath(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
        await Promise.all([...this.stores.values()].map((store: Store<Piece>) => store.loadAll()));
    }
}

declare module "@sapphire/pieces" {
    interface Container {
        client: TanjiroClient;
    }
}
