import { randomBytes } from "node:crypto";
import { GatewayDispatchEvents, GatewayMessageCreateDispatch, Routes } from "discord-api-types/v10";
import { Listener, ListenerOptions } from "../Stores/Listener.js";
import { ApplyOptions } from "../Utilities/Decorators/ApplyOptions.js";
import { Util } from "../Utilities/Util.js";
import { fetch, RequestInit } from "undici";
import { Result } from "@sapphire/result";
import { PhisingLevel } from "@prisma/client";
import { EmbedBuilder } from "@discordjs/builders";

@ApplyOptions<ListenerOptions>(({ container }) => ({
    name: "handlePhisingLinksListener",
    emitter: container.client,
    event: GatewayDispatchEvents.MessageCreate
}))

export class handlePhisingLinksListener extends Listener {
    public async run(raw: GatewayMessageCreateDispatch): Promise<any> {
        if ("guild_id" in raw.d && raw.d.guild_id) {
            const phisingSettings = await this.container.client.prisma.phising.findFirst({ where: { guildId: raw.d.guild_id } });
            if (phisingSettings?.enabled) {
                const links = Util.extractUrls(raw.d.content);
                for (const link of links) {
                    const result = await this.getResult(link);
                    if (result.isOk()) {
                        if (phisingSettings.level === PhisingLevel.LOW && result.unwrap().malicious > 4) return this.deleteMessage(raw, result);
                        if (phisingSettings.level === PhisingLevel.MEDIUM && result.unwrap().malicious > 3) return this.deleteMessage(raw, result);
                        if (phisingSettings.level === PhisingLevel.HIGH && result.unwrap().malicious > 2) return this.deleteMessage(raw, result);
                        if (phisingSettings.level === PhisingLevel.HIGHEST && result.unwrap().malicious > 1) return this.deleteMessage(raw, result);
                    }
                }
            }
        }
    }

    public async deleteMessage(raw: GatewayMessageCreateDispatch, result: Result<{ malicious: number }, unknown>): Promise<unknown> {
        const deleteMessage = await Result.fromAsync(() => this.container.client.rest.delete(Routes.channelMessage(raw.d.channel_id, raw.d.id)));
        const languageManager = await this.container.client.fetchLanguage(raw.d.guild_id!);
        return this.container.client.rest.post(Routes.channelMessages(raw.d.channel_id), {
            body: {
                embeds: [
                    new EmbedBuilder()
                        .setColor(15075685)
                        .setDescription(`🛡 | ${deleteMessage.isOk() ? languageManager("listeners/message:anti_scam_deleted", { User: raw.d.author.username, totalEngine: result.unwrap().malicious }) : languageManager("listeners/message:anti_scam_not_deleted", { User: raw.d.author.username, totalEngine: result.unwrap().malicious })}`)
                        .toJSON()
                ]
            }
        });
    }

    public async getResult(link: string): Promise<Result<{ malicious: number }, unknown>> {
        const body = new URLSearchParams();
        body.append("url", link);

        const headers = {
            "Accept-Ianguage": "en-US,en;q=0.9,es;q=0.8",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:83.0) Firefox",
            "X-Tool": "vt-ui-main",
            "X-VT-Anti-Abuse-Header": randomBytes(4).toString("hex")
        };
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        const response = await fetch("https://www.virustotal.com/ui/urls", { method: "POST", body, headers });
        if (response.ok) {
            const getAnalysesId = await response.json() as { data: { type: "analysis"; id: string } };
            headers["Content-Type"] = "application/json";
            const getAnalysesResult = await this.getAnalysesResult(getAnalysesId.data.id, headers as RequestInit, link);
            if (getAnalysesResult) {
                return Result.ok(getAnalysesResult);
            }
        }

        return Result.err();
    }

    public async getAnalysesResult(analysesId: string, headers: RequestInit | undefined, url: string): Promise<{ malicious: number } | null> {
        await fetch(`https://www.virustotal.com/ui/urls/analyses/${analysesId}`, headers);
        const response = await fetch(`https://www.virustotal.com/ui/urls/search?limit=20&${encodeURIComponent("relationships[comment]")}=${encodeURIComponent("author,item")}&query=${encodeURIComponent(url)}`, headers);
        if (response.ok) {
            const searchAnalysesResult = await response.json() as totalSearchResult;
            if (!searchAnalysesResult.data.length) return null;
            return searchAnalysesResult.data[0].attributes.last_analysis_stats;
        }
        return null;
    }
}

interface totalSearchResult {
    data: {
        attributes: {
            last_analysis_stats: {
                malicious: number;
            };
        };
    }[];
}
