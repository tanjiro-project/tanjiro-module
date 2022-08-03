import { Listener, ListenerOptions } from "../Stores/Listener.js";
import { ApplyOptions } from "../Utilities/Decorators/ApplyOptions.js";
import { CommonEvents } from "../Utilities/Enums/CommonEvents.js";

@ApplyOptions<ListenerOptions>({
    name: CommonEvents.Ready
})

export class readyListener extends Listener {
    public run(): void {
        this.logger.info(`${this.container.client.user!.username}#${this.container.client.user!.discriminator} is ready to serve you !`);
    }
}
