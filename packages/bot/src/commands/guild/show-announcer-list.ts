import type { MessageChannel } from '../../index';
import { ApplyOptions } from '@sapphire/decorators';
import {
  ApplicationCommandRegistry,
  Command,
  CommandOptions,
  container
} from '@sapphire/framework';
import { CommandInteraction, Guild, MessageEmbed } from 'discord.js';
import { PaginatedFieldMessageEmbed } from '@sapphire/discord.js-utilities';
import { trpcNode } from '../../trpc';

@ApplyOptions<CommandOptions>({
  name: 'show-announcer-list',
  description: 'Display the Guilds Twitch notification list',
  preconditions: ['GuildOnly', 'isCommandDisabled']
})
export class ShowAnnouncerListCommand extends Command {
  public override async chatInputRun(interaction: CommandInteraction) {
    const { client } = container;
    const interactionGuild = interaction.guild as Guild;

    const guildDB = await trpcNode.query('guild.get-guild', {
      id: interactionGuild.id
    });

    if (!guildDB || !guildDB.guild || guildDB.guild.notifyList.length === 0) {
      return await interaction.reply(':x: No streamers are in your list');
    }
    const icon = interactionGuild.iconURL({ dynamic: true });
    const baseEmbed = new MessageEmbed().setColor('#6441A5').setAuthor({
      name: `${interactionGuild.name} - Twitch Alerts`,
      iconURL: icon!
    });

    const users = await client.twitch.api
      .getUsers({
        ids: guildDB.guild.notifyList,
        token: client.twitch.auth.access_token
      })
      .catch(error => {
        if (error.status == 429) {
          return interaction.reply({
            content:
              ':x: Rate Limit exceeded. Please try again in a few minutes.'
          });
        }
        if (error.status == 500) {
          return interaction.reply({
            content: `:x: Twitch service's are currently unavailable. Please try again later.`
          });
        } else {
          return interaction.reply({
            content: `:x: Something went wrong.`
          });
        }
      });

    const myList = [];
    for (const streamer of users!) {
      for (const channel in client.twitch.notifyList[streamer.id].sendTo) {
        const guildChannel = client.channels.cache.get(
          client.twitch.notifyList[streamer.id].sendTo[channel]
        ) as MessageChannel;
        if (guildChannel)
          if (guildChannel.guild.id == interactionGuild.id)
            myList.push({
              name: streamer.display_name,
              channel: guildChannel.name
            });
      }
    }
    new PaginatedFieldMessageEmbed()
      .setTitleField('Streamers')
      .setTemplate(baseEmbed)
      .setItems(myList)
      .formatItems(
        (index: any) => `**${index.name}** Sending to **#${index.channel}**`
      )
      .setItemsPerPage(10)
      .make()
      .run(interaction);
  }

  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry
  ): void {
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
      return;
    }
    registry.registerChatInputCommand({
      name: this.name,
      description: this.description
    });
  }
}
