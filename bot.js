'use strict';

const Discord = require('discord.js');
const Twitch = require('./twitch');
const Storage = require('./storage');

const APP_HOST = 'discordbot.rayne14.repl.co';

class Bot{
	constructor(app){
		this.app = app;
		this.client = new Discord.Client();
		this.storage = new Storage();
		this.session = {
			start: Date.now(),
		};

		this.client.on('ready', () => {
			console.log(`[bot] Logged in as ${this.client.user.tag}!`);
			this.init();
		});

		this.client.on('message', this.handleMessage.bind(this));
		this.client.login(process.env.DISCORD_TOKEN);
	}
	async init(){
		// start twitch 
		// await this.storage.delete('Something Here','twitch_streamers');
		// console.log(`[bot] storage keys`,(await this.storage.list()));
		this.initTwitch();
		// create channels if needed
		// this.initChannels();
	}
	async initTwitch(){
		this.twitch = new Twitch(APP_HOST,this.app);
		await this.twitch.init();
		this.client.guilds.cache.map(async guild=>{
			const twitchStreamers = await this.storage.getTwitchStreamers(guild);
			await this.subscribeTwitchStreamChange(twitchStreamers,guild);
		});
	}
	async subscribeTwitchStreamChange(twitchStreamers,guild){
		await this.twitch.subscribeStreamChange(twitchStreamers,this.getTwitchStreamChangeHandler(guild));
	}
	async unsubscribeTwitchStreamChange(twitchStreamers,guild){
		await this.twitch.unsubscribeStreamChange(twitchStreamers);
	}
	getTwitchStreamChangeHandler(guild){
		return async (streamer,stream)=>{
			console.log(`[bot] getTwitchStreamChangeHandler for guild ${guild.id} on streamer ${streamer.displayName}`);
			const channel = await this.findChannel(guild,'twitch-streams');
			await this.sendTwitchStreamChangeMessage(guild,channel,streamer,stream);
		};
	}
	async initChannels(){
		this.client.guilds.cache.map(async guild=>{
			const botChannel = await this.findChannel(guild,'bot');
			const message = await botChannel.send('React for role');
			const colorRoles = {
				'red':'🔴',
				'orange':'🟠',
				'yellow':'🟡',
				'green':'🟢',
				'blue':'🔵',
				'violet':'🟣',
				'brown':'🟤',
			};
			Object.keys(colorRoles).map(key=>{
				message.react(colorRoles[key]);
			});
		});
	}
	async findChannel(guild,name){
		let channel = await guild.channels.cache.find((channel)=>channel.name.toLowerCase()==name);
		if(channel==null){
			console.log(`[bot] create ${name} channel`);
			channel = await guild.channels.create(name);
		}
		return channel;
	}
	async sendTwitchStreamChangeMessage(guild,channel,streamer,stream){
		const embed = new Discord.MessageEmbed({
			url: `https://twitch.tv/${streamer.name}`,
			thumbnail: {
				url: streamer.profilePictureUrl.replace('{width}',600).replace('{height}',400),
				width: 600,
				height: 400,
			},
		});
		if(stream){
			const game = await stream.getGame();
			embed.setTitle(stream.title);
			embed.setTimestamp(stream.startDate);
			embed.setDescription(`${streamer.displayName} is playing ${game.name}\n\n${streamer.description}`);
			embed.setImage(stream.thumbnailUrl.replace('{width}',600).replace('{height}',400));
			channel.send(`${streamer.displayName} is live!`,embed);
		}else{
			embed.setTitle(streamer.displayName);
			embed.setImage(streamer.offlinePlaceholerUrl);
			embed.setDescription(`${streamer.description}`);
			channel.send(`${streamer.displayName} is currently offline!`,embed);
		}
	}
	findNumberEmoji(i){
		return (['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'][i])||'';
	}
	// the meat of the bot, maybe refactor later
	async handleMessage(msg){
		const guild = msg.guild;
		const senderIsAdmin = msg.member.permissions.has(Discord.Permissions.MANAGE_SERVER);
		const isCommand = msg.content[0]=='!';
		if(isCommand){
			const args = msg.content.split(' ');
			const command = args[0].slice(1);
			const action = args[1];
			switch(command){
				case 'roles':
				if(!senderIsAdmin) break;
				const roles = msg.guild.roles.cache.filter(role=>!role.name.startsWith('@')&&!role.managed&&!role.deleted);
				console.log(roles);
				msg.channel.send(`Roles: \n${roles.map(role=>role.name).join('\n')}`);
				break;
				case 'achoo':
				msg.react('🤧');
				break;
				case 'twitch':
				let changed = false;
				const streamerNames = await this.storage.getTwitchStreamers(guild);
				const streamerName = args[2];
				switch(action){
					case 'list':
					if(!senderIsAdmin) break;
					msg.channel.send(`Twitch Streamers: \n${streamerNames.join('\n')}`);
					break;
					case 'add':
					if(!senderIsAdmin) break;
					if(streamerName&&streamerNames.indexOf(streamerName)<0){
						streamerNames.push(streamerName);
						this.subscribeTwitchStreamChange([streamerName],guild);
						changed = true;
						msg.channel.send(`Twitch Streamer added: ${streamerName}`);
					}else{
						msg.channel.send(`Twitch Streamer already on the list: ${streamerName}`);
					}
					break;
					case 'delete':
					if(!senderIsAdmin) break;
					if(streamerName&&streamerNames.indexOf(streamerName)>=0){
						streamerNames.splice(streamerNames.indexOf(streamerName),1);
						this.unsubscribeTwitchStreamChange([streamerName],guild);
						changed = true;
						msg.channel.send(`Twitch Streamer deleted: ${streamerName}`);
					}else{
						msg.channel.send(`Twitch Streamer is not on the list: ${streamerName}`);
					}
					break;
					case 'info':
					if(streamerName){
						const streamer = await this.twitch.findUser(streamerName);
						if(streamer){
							const channel = msg.channel;
							const stream = await streamer.getStream();
							await this.sendTwitchStreamChangeMessage(guild,channel,streamer,stream);
						}else{
							channel.send(`${streamerName} not found!`);
						}
					}
					break;
				}
				if(changed){
					console.log(`[bot] twitch_streamers updated: ${JSON.stringify(streamerNames)}`);
					await this.storage.set(guild,'twitch_streamers',JSON.stringify(streamerNames));
				}
				break;
				case 'poll':
				const pollArgs = args.slice(1);
				if(pollArgs.length==0){
					msg.channel.send('Usage: \n`!poll [option1], [option2], ...` or\n`!poll [Title of your poll]: [option1], [option2], ...`(with title) \n');
					break;
				}
				const pollEmbed = new Discord.MessageEmbed({
					footer: {
						text: `${msg.member.displayName}'s Poll`,
					}
				});
				const titleAndOptions = pollArgs.join(' ').split(':');
				const options = (titleAndOptions.length>1?titleAndOptions.pop():titleAndOptions[0]).split(',').map(option=>option.trim());
				if(options.length<2) {
					msg.channel.send('Poll must include at least two options!');
					break;
				}
				const title = titleAndOptions[0]||'';
				pollEmbed.setTitle(title);
				pollEmbed.setDescription(options.slice(0,10).map((o,i)=>`${this.findNumberEmoji(i+1)} - ${o}`));
				const pollMessage = await msg.channel.send(` `,pollEmbed);
				(options).map((o,i)=>{
					const emoji = this.findNumberEmoji(i+1);
					pollMessage.react(`${emoji}`);
				});
				break;
				case 'custom':
				switch(action){
					case 'list':
					const commands = await this.storage.listCustomCommands(guild);
					console.log(`[bot] commands`,commands);
					msg.channel.send(`Commands: \n${commands.map(command=>`!${command}`).join('\n')}`);
					break;
					case 'add':
					if(!senderIsAdmin) break;
					await this.storage.setCustomCommand(guild,args[2],args.slice(3).join(' '));
					msg.channel.send(`Custom command added: ${args[2]}`);
					break;
					case 'delete':
					if(!senderIsAdmin) break;
					await this.storage.deleteCustomCommand(guild,args[2]);
					msg.channel.send(`Custom command deleted: ${args[2]}`);
					break;
				}
				break;
				default:
				const m = await this.storage.getCustomCommand(guild,command);
				if(m){
					msg.channel.send(m);
				}
				break;
			}
		}
	}
}


module.exports = Bot;