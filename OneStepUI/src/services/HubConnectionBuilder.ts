import * as signalR from "@microsoft/signalr";
import { supabase } from "../auth";

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const url = import.meta.env.VITE_API_URL + "/playgroundHub";

export const connection = new signalR.HubConnectionBuilder()
  .withUrl(url, {
    accessTokenFactory: getAccessToken,
  })
  .withAutomaticReconnect()
  .build();

class SignalRService {
  private started = false;

  async start() {
    if (this.started) {
      return;
    }

    try {
      await connection.start();
      this.started = true;
      console.log("SignalR connected");
    } catch (error) {
      this.started = false;
      console.error("SignalR failed to connect", error);
      throw error;
    }
  }

  async stop() {
    if (!this.started) {
      return;
    }

    await connection.stop();
    this.started = false;
  }
}

export const signalRService = new SignalRService();