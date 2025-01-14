import { createRouter } from "../createRouter";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

type CommandType = {
  id: string;
  applicationId: string;
  version: string;
  default_permission: string;
  default_member_permissions: null | string[];
  type: number;
  name: string;
  description: string;
  dm_permission: boolean;
  options: any[];
};

export const commandRouter = createRouter()
  .query("get-disabled-commands", {
    input: z.object({
      guildId: z.string(),
    }),
    async resolve({ ctx, input }) {
      const { guildId } = input;

      const guild = await ctx.prisma.guild.findUnique({
        where: {
          id: guildId,
        },
        select: {
          disabledCommands: true,
        },
      });

      if (!guild) {
        throw new TRPCError({ message: "Guild not found", code: "NOT_FOUND" });
      }

      return { disabledCommands: guild.disabledCommands };
    },
  })
  .query("get-commands", {
    input: z.object({
      guildId: z.string(),
    }),
    async resolve() {
      try {
        const token = process.env.DISCORD_TOKEN;
        const response = await fetch(
          `https://discordapp.com/api/applications/${process.env.DISCORD_CLIENT_ID}/commands`,
          {
            headers: {
              Authorization: `Bot ${token}`,
            },
          }
        );
        const commands: CommandType[] = await response.json();

        return { commands };
      } catch (e) {
        console.error(e);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong when trying to fetch guilds",
        });
      }
    },
  })
  .mutation("toggle-command", {
    input: z.object({
      guildId: z.string(),
      commandId: z.string(),
      status: z.boolean(),
    }),
    async resolve({ ctx, input }) {
      const { guildId, commandId, status } = input;

      const guild = await ctx.prisma.guild.findUnique({
        where: {
          id: guildId,
        },
        select: {
          disabledCommands: true,
        },
      });

      if (!guild) {
        throw new TRPCError({ message: "Guild not found", code: "NOT_FOUND" });
      }

      let updatedGuild;

      if (status) {
        updatedGuild = await ctx.prisma.guild.update({
          where: {
            id: guildId,
          },
          data: {
            disabledCommands: {
              set: [...guild?.disabledCommands, commandId],
            },
          },
        });
      } else {
        updatedGuild = await ctx.prisma.guild.update({
          where: {
            id: guildId,
          },
          data: {
            disabledCommands: {
              set: guild?.disabledCommands.filter((cid) => cid !== commandId),
            },
          },
        });
      }

      return { updatedGuild };
    },
  });
