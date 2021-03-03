'use strict';

const Discord = require('discord.js');
class DiscordLogger {
	constructor(){
	}
	setBot(bot){
		this.bot = bot;
	}
	async log(msg,embedContent){
		if(this.bot){
			const user = await this.bot.users.fetch(process.env.MY_DISCORD_ID);
			const embed = embedContent?(new Discord.MessageEmbed({
				title: ``,
				description: embedContent,
			})):null;
			user.send(`\`\`\`${msg}\`\`\``,embed);
		}
		console.log(msg);
	}
}

module.exports = new DiscordLogger(); 