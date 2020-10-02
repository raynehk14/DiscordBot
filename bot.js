'use strict';

const Discord = require('discord.js');
const Twitch = require('./twitch');
const Storage = require('./storage');

const APP_HOST = 'discordbot.rayne14.repl.co';

class Bot{
	constructor(app){
		this.app = app;
		this.client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
		this.storage = new Storage();
		this._roleListeners = [];

		this.client.on('ready', () => {
			console.log(`[bot] Logged in as ${this.client.user.tag}!`);
			this.init();
		});

		this.client.on('message', this.handleMessage.bind(this));
		this.client.on('messageReactionAdd', this.handleMessageReactionAdd.bind(this));
		this.client.on('messageReactionRemove', this.handleMessageReactionRemove.bind(this));
		this.client.login(process.env.DISCORD_TOKEN);
	}
	async init(){
		// storage debugs
		// await this.storage.delete('Something Here','twitch_streamers');
		// console.log(`[bot] storage keys`,(await this.storage.list()));
		// guild listeners
		this.initGuilds();
		// start twitch 
		this.initTwitch();
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
	async initGuilds(){
		this.client.guilds.cache.map(async guild=>{
			const arr = await this.storage.getRoleAssignmentMessage(guild);
			const [channelId,messageId] = arr;
			if(channelId&&messageId){
				this.addRoleListener(guild,channelId,messageId);
			}
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
	addRoleListener(guild,channelId,roleMessageId){
		console.log(`[bot] roleListener added: ${guild.name} in channel ${channelId}, message ${roleMessageId}`);
		this._roleListeners.push([guild.id,channelId,roleMessageId]);
	}
	async handleRoleAssignment(guild,user,emoji,add){
		const member = guild.member(user);
		const role = await this.storage.getRoleAssignmentByEmoji(guild,emoji);
		if(role){
			if(add){
				console.log(`[bot] handleRoleAssignment: adding role ${role} to user ${member.displayName}`);
				member.roles.add(role);
			}else{
				console.log(`[bot] handleRoleAssignment: removing role ${role} to user ${member.displayName}`);
				member.roles.remove(role);
			}
		}
	}

	// the meat of the bot, maybe refactor later
	async handleMessage(msg){
		if(!(await this.handlePartialMessage(msg))) return;
		if(msg.author.id==this.client.user.id) return;
		const guild = msg.guild;
		const isSenderAdmin = msg.member.permissions.has(Discord.Permissions.MANAGE_SERVER);
		const isCommand = msg.content[0]=='!';
		if(isCommand){
			const args = msg.content.split(' ');
			const command = args[0].slice(1);
			const action = args[1];
			const emptyCommand = args.slice(1).length==0;
			let cleanup = false;
			switch(command){
				case 'achoo':
				msg.react('🤧');
				break;
				case 'twitch':
				let changed = false;
				const streamerNames = await this.storage.getTwitchStreamers(guild);
				const streamerName = args[2];
				switch(action){
					case 'list':
					if(!isSenderAdmin) break;
					msg.channel.send(`Twitch Streamers: \n${streamerNames.join('\n')}`);
					break;
					case 'add':
					if(!isSenderAdmin) break;
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
					if(!isSenderAdmin) break;
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
							const stream = await streamer.getStream();
							await this.sendTwitchStreamChangeMessage(guild,msg.channel,streamer,stream);
						}else{
							msg.channel.send(`${streamerName} not found!`);
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
				if(emptyCommand){
					msg.channel.send('Usage: \n`!poll [option1], [option2], ...` or\n`!poll [Title of your poll]: [option1], [option2], ...`(with title) \n');
					break;
				}
				const pollArgs = args.slice(1);
				const pollEmbed = new Discord.MessageEmbed({
					footer: {
						text: `${msg.author.displayName}'s Poll`,
						iconUrl: msg.author.avatarURL(),
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
					if(!isSenderAdmin) break;
					await this.storage.setCustomCommand(guild,args[2],args.slice(3).join(' '));
					msg.channel.send(`Custom command added by ${msg.author.tag}: ${args[2]}`);
					break;
					case 'delete':
					if(!isSenderAdmin) break;
					await this.storage.deleteCustomCommand(guild,args[2]);
					msg.channel.send(`Custom command deleted by ${msg.author.tag}: ${args[2]}`);
					break;
				}
				break;
				case 'roles':
				if(!isSenderAdmin) break;
				const roles = msg.guild.roles.cache.filter(role=>!role.name.startsWith('@')&&!role.managed&&!role.deleted);
				msg.channel.send(`Roles: \n${roles.map(role=>`${role.name}:${role.id}`).join('\n')}`);
				break;
				case 'role':
				if(!isSenderAdmin) break;
				if(emptyCommand){
					msg.channel.send(`Manage role assignments with bot\nUsage: \`!role [add|delete|list|post]\``);
				}
				const roleId = args[2];
				const emoji = args[3];
				switch(action){
					case 'add':{
						if(!roleId){
							msg.channel.send(`Usage: \`!role add [roleId] [emoji(optional)]\``);
							break;
						}
						const role = msg.guild.roles.cache.find(r=>r.id==roleId);
						if(!role){
							msg.channel.send(`Role not found.\``);
							break;
						}
						await this.storage.addRoleAssignment(guild,roleId,emoji);
						msg.channel.send(`Role added for react assignment: ${role.name} (emoji: ${emoji})`);
					}
					break;
					case 'delete':{
						if(!roleId){
							msg.channel.send(`Usage: \`!role delete [roleId]\``);
							break;
						}
						const role = msg.guild.roles.cache.find(r=>r.id==roleId);
						if(!role){
							msg.channel.send(`Role not found.\``);
							break;
						}
						await this.storage.deleteRoleAssignment(guild,roleId,emoji);
						msg.channel.send(`Role deleted for react assignment: ${role.name}`);
					}
					break;
					case 'list':{
						const roles = await this.storage.listRoleAssignments(guild);
						msg.channel.send(`Current roles for react assignment: \n${roles.map(r=>`${r.role.name}: ${r.emoji}`).join('\n')}`);
					}
					break;
					case 'post':{
						const [channelId,messageId] = await this.storage.getRoleAssignmentMessage(guild);
						if(channelId&&messageId){
							try{
								const postChannel = await guild.channels.cache.get(channelId);
								const postMessage = await postChannel.messages.fetch(messageId);
								await postMessage.delete();
								console.log(`[bot] Deleted old post message in ${postChannel.name}`);
							}catch(error){
								console.log(`[bot] Delete old post message error:`,error);
							}
						}
						const roles = await this.storage.listRoleAssignments(guild);
						const roleMessage = await msg.channel.send(``,(new Discord.MessageEmbed({
							title: 'React to get a role!',
							description: `${roles.map(r=>`${r.emoji} - ${r.role.name}`).join('\n')}`
						})));
						Object.keys(roles).map((key,i)=>{
							let emoji = roles[key].emoji;
							try{if(emoji&&emoji.split) emoji = emoji.split(':')[2].split('>')[0];}catch(err){}
							roleMessage.react(emoji||this.findNumberEmoji(i));
						});
						await this.storage.setRoleAssignmentMessage(guild,roleMessage.channel.id,roleMessage.id);
						this.addRoleListener(guild,roleMessage.channel.id,roleMessage.id);
						cleanup = true;
					}
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
			if(cleanup){
				msg.delete();
			}
		}
	}
	async handlePartialMessage(message){
		if (message.partial) {
			try {
				await message.fetch();
			} catch (error) {
				console.error('Something went wrong when fetching the message: ', error);
				return false;
			}
		}
		return true;
	}
	async handleMessageReactionAdd(msgReact,user){
		if(!(await this.handlePartialMessage(msgReact))) return;
		if(user.id==this.client.user.id) return;
		const {message,emoji,me} = msgReact;
		const {guild,channel} = message;
		// console.log(`[bot] handleMessageReactionAdd ${guild}, ${channel.id}, ${message.id}`);
		this._roleListeners.map(async(arr)=>{
			const [guildId,channelId,messageId] = arr;
			if(guild.id==guildId&&channel.id==channelId&&message.id==messageId){
				await this.handleRoleAssignment(guild,user,emoji,true);
			}
		})
	}
	async handleMessageReactionRemove(msgReact,user){
		if(!(await this.handlePartialMessage(msgReact))) return;
		if(user.id==this.client.user.id) return;
		const {message,emoji,me} = msgReact;
		const {guild,channel} = message;
		// console.log(`[bot] handleMessageReactionRemove ${guild}, ${channel.id}, ${message.id}`);
		this._roleListeners.map(async(arr)=>{
			const [guildId,channelId,messageId] = arr;
			if(guild.id==guildId&&channel.id==channelId&&message.id==messageId){
				await this.handleRoleAssignment(guild,user,emoji,false);
			}
		})
	}
}


module.exports = Bot;