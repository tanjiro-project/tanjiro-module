/* eslint-disable prefer-named-capture-group */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-extraneous-class */
export class Util {
    public static formatDate(dateFormat: Intl.DateTimeFormat, date: Date | number = new Date()): string {
        const data = dateFormat.formatToParts(date);
        return "<year>-<month>-<day>"
            .replace(/<year>/g, data.find(d => d.type === "year")!.value)
            .replace(/<month>/g, data.find(d => d.type === "month")!.value)
            .replace(/<day>/g, data.find(d => d.type === "day")!.value);
    }

    public static extractUrls(text: string, lower = true): string[] {
        const regexp = /(https?:\/\/)?([1-9]\d{0,3})?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?!&//=]*)/gi;

        const urls = text.match(regexp);
        if (urls) {
            return lower ? urls.map(item => (item.toLowerCase().startsWith("http") ? item.toLowerCase() : `https://${item.toLowerCase()}`)) : urls.map(item => (item.startsWith("http") ? item : `https://${item}`));
        }

        return [];
    }

    public static extractDiscordUrls(text: string, lower = true): string[] {
        const regexp = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/([a-z-0-9A-Z]+)/gi;

        const urls = text.match(regexp);
        if (urls) {
            return lower ? urls.map(item => (item.toLowerCase().startsWith("http") ? item.toLowerCase() : `https://${item.toLowerCase()}`)) : urls.map(item => (item.startsWith("http") ? item : `https://${item}`));
        }

        return [];
    }
}
