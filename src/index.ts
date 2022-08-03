import "dotenv/config";
import { TanjiroClient } from "./Structures/TanjiroClient.js";

const client = new TanjiroClient();
await client.iniitalize();
