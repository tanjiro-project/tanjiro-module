/* eslint-disable prefer-named-capture-group */
import { GatewayDispatchEvents, GatewayMessageUpdateDispatch, Routes } from "discord-api-types/v10";
import { Listener, ListenerOptions } from "../Stores/Listener.js";
import { ApplyOptions } from "../Utilities/Decorators/ApplyOptions.js";
import { Util } from "../Utilities/Util.js";
import { Result } from "@sapphire/result";
import { EmbedBuilder, inlineCode } from "@discordjs/builders";

@ApplyOptions<ListenerOptions>(({ container }) => ({
    name: "handleDiscordInviteLinksEditsListener",
    emitter: container.client.amqpTwilightReceiver,
    event: GatewayDispatchEvents.MessageUpdate
}))

export class handleDiscordInviteLinksEditsListener extends Listener {
    public async run(raw: GatewayMessageUpdateDispatch): Promise<any> {
        if ("guild_id" in raw.d && raw.d.guild_id) {
            const inviteSettings = await this.container.client.prisma.invite.findFirst({ where: { guildId: raw.d.guild_id } });
            if (inviteSettings?.enabled) {
                const links = Util.extractDiscordUrls(raw.d.content);
                for (const link of links) {
                    const [,,,,, code] = link.match(/(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/([a-z-0-9A-Z]+)/gi) ?? [];
                    if (code) {
                        const result = await Result.fromAsync(() => this.container.client.rest.get(Routes.invite(code)));
                        if (result.isOk()) return this.deleteMessage(raw);
                    }
                }
            }
        }
    }

    public async deleteMessage(raw: GatewayMessageUpdateDispatch): Promise<unknown> {
        const deleteMessage = await Result.fromAsync(() => this.container.client.rest.delete(Routes.channelMessage(raw.d.channel_id, raw.d.id)));
        const languageManager = await this.container.client.fetchLanguage(raw.d.guild_id!);
        return this.container.client.rest.post(Routes.channelMessages(raw.d.channel_id), {
            body: {
                embeds: [
                    new EmbedBuilder()
                        .setColor(15075685)
                        .setDescription(`🛡 | ${deleteMessage.isOk() ? languageManager("listeners/message:anti_invite_deleted", { User: inlineCode(raw.d.author?.username ?? "Unknown User") }) : languageManager("listeners/message:anti_invite_not_deleted", { User: inlineCode(raw.d.author?.username ?? "Unknown User") })}`)
                        .toJSON()
                ]
            }
        });
    }
}
