'use strict';

const Discord = require('discord.js');
const Twitch = require('./twitch');
const Youtube = require('./youtube');
const Wikia = require('./wikia');
const Time = require('./time');
const Misc = require('./misc');
const Help = require('./help');
const Minesweeper = require('./minesweeper');
const Storage = require('./storage');
const DBStorage = require('./dbstorage');
const logger = require('./discordLogger');

const APP_HOST = 'discordbot.rayne14.repl.co';

class Bot {
	constructor(app) {
		this.app = app;
		this.bot = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
		this.storage = new Storage();
		this.session = {
			// reminders: [],
		};
		this._roleListeners = [];

		this.bot.on('ready', () => {
			logger.setBot(this.bot);
			logger.log(`[bot] Logged in as ${this.bot.user.tag}!`);
			this.init();
		});

		this.bot.on('message', this.handleMessage.bind(this));
		this.bot.on('messageReactionAdd', this.handleMessageReactionAdd.bind(this));
		this.bot.on('messageReactionRemove', this.handleMessageReactionRemove.bind(this));
		this.bot.login(process.env.DISCORD_TOKEN);
	}
	async init() {
		// storage debugs
		// await this.storage.delete('Something Here','twitch_streamers');
		// logger.log(`[bot] storage keys`,(await this.storage.list()));
		// this.storage.deleteWithPrefix(`youtube:`);
		// global thread
		this.startGlobalThread();
		// guild listeners
		this.initGuilds();
		// start twitch 
		this.initTwitch();
		// start youtube
		this.initYoutube();
	}
	async initTwitch() {
		this.twitch = new Twitch(APP_HOST, this.app);
		await this.twitch.init();
		this.bot.guilds.cache.map(async guild => {
			const twitchStreamers = await DBStorage.getTwitchStreamers(guild);
			await this.subscribeTwitchStreamChange(twitchStreamers, guild);
		});
	}
	async subscribeTwitchStreamChange(twitchStreamers, guild) {
		await this.twitch.subscribeStreamChange(twitchStreamers, this.getTwitchStreamChangeHandler(guild));
	}
	async unsubscribeTwitchStreamChange(twitchStreamers, guild) {
		await this.twitch.unsubscribeStreamChange(twitchStreamers);
	}
	getTwitchStreamChangeHandler(guild) {
		return async (streamer, stream) => {
			logger.log(`[bot] getTwitchStreamChangeHandler for guild ${guild.id} on streamer ${streamer.displayName}`);
			const channel = await this.findChannel(guild, 'twitch-streams');
			await this.sendTwitchStreamChangeMessage(guild, channel, streamer, stream);
		};
	}
	async initYoutube() {
		this.youtube = new Youtube(this.storage);
	}
	async initGuilds() {
		this.bot.guilds.cache.map(async guild => {
			// update server name on DB for reference
			DBStorage.setGuildName(guild);
			// setup messages
			const {channelId, messageId} = await DBStorage.getRoleAssignmentMessage(guild);
			if (channelId && messageId) {
				this.addRoleListener(guild, channelId, messageId);
			}
			this.session[guild.id] = {
				helpMessages: {},
			};
		});
		this.bot.on('guildMemberAdd', async member => {
			const guild = member.guild;
			const {message,channelId} = await DBStorage.getGreetingMessage(guild);
			// logger.log(`[guildMemberAdd] ${guild.name}: ${member.displayName} joined, looking up greeting message... channel: ${channelId}, message: ${!!greet}`);
			if (message && channelId) {
				const channel = guild.channels.cache.get(channelId);
				if (channel) {
					await channel.send(`<@${member.id}> ${message}`);
				}
			}
		});
	}
	async findChannel(guild, name) {
		let channel = await guild.channels.cache.find((channel) => channel.name.toLowerCase() == name);
		if (channel == null) {
			logger.log(`[bot] create ${name} channel`);
			channel = await guild.channels.create(name);
		}
		return channel;
	}
	async startGlobalThread() {
		this.threadMinuteTick();
	}
	async threadMinuteTick() {
		// dbdump
		if(!this.lastTick||!Time.isSameDay(this.lastTick)){
			// const dump = await this.storage.dump();
			// logger.log('[bot] daily dbdump',`\`\`\`${dump}\`\`\``);
		}
		this.lastTick = Time.now();
		// reminders
		const reminders = (this.bot.guilds.cache.map(async guild => {
			const reminders = await DBStorage.listReminders(guild);
			await Promise.all(Object.keys(reminders).map(async reminderName => {
				const {timeString,timezoneString,channelId} = reminders[reminderName];
				const m = Time.m(timeString, timezoneString);
				const inThePast = Time.inThePast(m);
				// logger.log(`[bot] guild ${guild.name} reminder ${reminderName} is in the ${inThePast?'past':'future'}: ${Time.format(m)}`);
				const channel = guild.channels.cache.find(channel => channel.id == channelId);
				if (!channel && reminderName) {
					logger.log(`[bot] guild ${guild.name} reminder ${reminderName} channel(${channelId}) not found, TODO: clean up possible incorrect syntax reminder ${reminderName}`);
					// DEBUG - disable delete with prefix to see if this was causing the db wipe issue
					// await this.storage.deleteWithPrefix(storageKey);
				} else {
					if (inThePast) {
						channel.send(``, new Discord.MessageEmbed({
							title: reminderName,
							description: '',
							footer: {
								text: `Schdueled at ${timeString}, ${timezoneString}`
							},
						}));
						DBStorage.deleteReminder(guild, reminderName);
					}
				}
			}));
		}));
		// remind mes
		const userEvents = ((await DBStorage.listUsersWithEvents()).map(async ({_id:userId,events}) => {
			Object.keys(events).map(async eventName=>{
				const {timeString, timezoneString} = events[eventName];
				const m = Time.m(timeString, timezoneString);
				try{
					const user = await this.bot.users.fetch(userId);
					const inThePast = Time.inThePast(m);
					loggerr.log(`[bot] user ${user.tag} reminder ${eventName} is in the ${inThePast ? 'past' : 'future'}: ${Time.format(m)}`);
					if (inThePast) {
						user.send(`You asked me to remind you about \`${eventName}\` on ${timeString}, ${timezoneString}!`);
						DBStorage.deleteUserEvent(user.id, eventName);
					}
				}catch(error){
					// auto delete on error
					DBStorage.deleteUserEvent(userId, eventName);
				}
			});
		}));
		await Promise.all([...reminders, userEvents]);
		const msTilNextRoundMinute = Time.msTilNextRoundMinute();
		setTimeout(() => this.threadMinuteTick(), msTilNextRoundMinute);
	}
	async sendTwitchStreamChangeMessage(guild, channel, streamer, stream) {
		// console.log('streamer',streamer);
		const tsString = '?' + (Date.now()).toString(16);
		const embed = new Discord.MessageEmbed({
			url: `https://twitch.tv/${streamer.name}`,
			thumbnail: {
				url: streamer.profilePictureUrl.replace('{width}', 600).replace('{height}', 400) + tsString,
				width: 600,
				height: 400,
			},
		});
		if (stream) {
			const game = await stream.getGame();
			embed.setTitle(stream.title);
			embed.setTimestamp(stream.startDate);
			embed.setDescription(`${streamer.displayName} is playing ${game.name}\n\n${streamer.description}`);
			if(stream.thumbnailUrl) embed.setImage(stream.thumbnailUrl.replace('{width}', 600).replace('{height}', 400) + tsString);
			channel.send(`${streamer.displayName} is live!`, embed);
		} else {
			embed.setTitle(streamer.displayName);
			if(streamer.offlinePlaceholerUrl) embed.setImage(streamer.offlinePlaceholerUrl + tsString);
			embed.setDescription(`${streamer.description}`);
			channel.send(`${streamer.displayName} is currently offline!`, embed);
		}
	}
	findNumberEmoji(i) {
		return (['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][i]) || '';
	}
	addRoleListener(guild, channelId, roleMessageId) {
		logger.log(`[bot] roleListener added: ${guild.name} in channel ${channelId}, message ${roleMessageId}`);
		this._roleListeners.push([guild.id, channelId, roleMessageId]);
	}
	async handleRoleAssignment(guild, user, emoji, add) {
		const member = guild.member(user);
		const role = await DBStorage.getRoleAssignmentByEmoji(guild, emoji);
		if (role) {
			if (add) {
				logger.log(`[bot][${guild.name}] handleRoleAssignment: adding role ${role} to user ${member.displayName}`);
				member.roles.add(role);
			} else {
				logger.log(`[bot][${guild.name}] handleRoleAssignment: removing role ${role} from user ${member.displayName}`);
				member.roles.remove(role);
			}
		}
	}
	// additional render helpers
	async renderMessageCommandHelp(msg, page) {
		const { guild } = msg;
		this.cleanUpGuildMessageCommandHelp(guild);
		const commandPrefix = await DBStorage.getGuildSettings(guild, 'commandPrefix') || '!';
		const render = (help) => {
			return Help.renderHelp(help, commandPrefix);
		};
		const helpItems = Help.getPage(page).map(render);
		const helpItemPages = Help.getPageCount();
		// logger.log(`[bot] help message: render page ${page} (items found: ${helpItems.length})`);
		if (helpItems.length != 0) {
			await msg.edit(``, new Discord.MessageEmbed({
				title: 'Command List',
				description: helpItems.join('\n\n'),
				footer: {
					text: `Page ${page + 1} of ${helpItemPages}`,
				},
			}));
			this.session[guild.id].helpMessages[msg.id] = page;
		}
		['◀', '▶'].map(emoji => {
			msg.react(emoji);
		});
	}
	// only keep the last 10 messages
	async cleanUpGuildMessageCommandHelp(guild) {
		const msgIds = Object.keys(this.session[guild.id].helpMessages);
		const remaining = msgIds.splice(-10); // splice last 10 out
		msgIds.map(msgId => {
			// TODO find a way to clean up reacts
			delete this.session[guild.id].helpMessages[msgId];
		});
	}
	async sendNoPermissionMessage(originalMsg) {
		const msg = await originalMsg.channel.send(`You have insufficient permissions.`);
		setTimeout(async () => (await msg.delete()), 3000);
	}
	// the meat of the bot, maybe refactor later
	async handleMessage(msg) {
		if (!(await this.handlePartialMessage(msg))) return;
		if (msg.author.id == this.bot.user.id) return; // skip self messages
		const guild = msg.guild;
		const commandPrefix = await DBStorage.getGuildSettings(guild, 'commandPrefix') || '!';
		const customPrefixOff = await DBStorage.getGuildSettings(guild, 'customPrefixOff');
		// logger.log(`[bot] guild ${guild.name} is using command prefix ${commandPrefix}`);
		const isCommand = msg.content.indexOf(commandPrefix) == 0;
		const isSenderAdmin = msg.member && msg.member.hasPermission('ADMINISTRATOR');
		const isSenderMod = msg.member && msg.member.hasPermission(['MANAGE_ROLES', 'MANAGE_CHANNELS']);
		const args = msg.content.slice(commandPrefix.length).split(' ');
		const command = args[0];
		const commandArg = args.slice(1);
		const commandArgRaw = commandArg.join(' ');
		const emptyCommand = commandArg.length == 0;
		const action = commandArg[0];
		const params = { msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix };
		// logger.log(`[bot] guild ${guild.name} command params:,`, params);
		if (isCommand) {
			switch (command) {
				// case '_dbdump':
				// 	if(msg.author.id==process.env.MY_DISCORD_ID){
				// 		const dump = await this.storage.dump();
				// 		msg.author.send(``, new Discord.MessageEmbed({
				// 			title: 'db dump',
				// 			description: `\`\`\`${dump}\`\`\``,
				// 		}));
				// 	}
				// 	break;
				case 'achoo':
					msg.react('🤧');
					msg.reply('bless you!');
					break;
				case 'hydrate':
					msg.channel.send('Reminder to drink water!');
					break;
				case 'help':
					await this.handleMessageCommandHelp(params);
					break;
				case 'prefix':
					await this.handleMessageCommandPrefix(params);
					break;
				case 'twitch':
					await this.handleMessageCommandTwitch(params);
					break;
				case 'youtube':
					await this.handleMessageCommandYoutube(params);
					break;
				case 'poll':
					await this.handleMessageCommandPoll(params);
					break;
				case 'custom':
					await this.handleMessageCommandCustom(params);
					break;
				case 'say':
					await this.handleMessageCommandSay(params);
					break;
				case 'role':
					await this.handleMessageCommandRole(params);
					break;
				case 'wikia':
					await this.handleMessageCommandWikia(params);
					break;
				case 'now':
					await this.handleMessageCommandNow(params);
					break;
				case 'timetill':
					await this.handleMessageCommandTimeTill(params);
					break;
				case 'remindme':
					await this.handleMessageCommandRemindMe(params);
					break;
				case 'reminder':
					await this.handleMessageCommandReminder(params);
					break;
				case 'roll':
					await this.handleMessageCommandRoll(params);
					break;
				case 'flip':
					await this.handleMessageCommandFlip(params);
					break;
				case 'mine':
					await this.handleMessageCommandMinesweeper(params);
					break;
				case 'greet':
					await this.handleMessageCommandGreet(params);
					break;
				default:
					if(isCommand&&!customPrefixOff){
						params.command = (command + ' ' + commandArgRaw).trim();
						await this.handleMessageCustomCommand(params);
					}
					break;
			}
		} else {
			// logger.log(`[bot] customPrefixOff: ${customPrefixOff}`);
			if (customPrefixOff) {
				const commands = await DBStorage.listCustomCommands(guild);
				for (let i = 0, command; command = commands[i]; i++) {
					if (msg.content == command) {
						// logger.log(`[bot] customPrefixOff command found: ${command}`);
						params.command = command;
						await this.handleMessageCustomCommand(params);
					}
				}
			}
		}
	}
	async handleMessageCommandPrefix({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		if (!isSenderMod) return this.sendNoPermissionMessage(msg);
		const prefix = commandArgRaw;
		if (prefix) {
			await DBStorage.setGuildSettings(guild, 'commandPrefix', prefix);
			msg.channel.send(`${prefix} is now the server prefix. \ne.g. use \`${prefix}help\` for help.`);
		} else {
			msg.channel.send(Help.renderCommandUsage('prefix', commandPrefix));
		}
	}
	async handleMessageCommandHelp({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		const helpMsg = await msg.channel.send(``, new Discord.MessageEmbed({
			title: 'Command List',
			description: '',
		}));
		this.renderMessageCommandHelp(helpMsg, 0);
		return true;
	}
	async handleMessageCommandYoutube({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		if (commandArgRaw) {
			const youtubeUrl = await this.youtube.search(commandArgRaw);
			await msg.channel.send(`${youtubeUrl}`);
		}
	}
	async handleMessageCommandTwitch({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		let changed = false;
		const streamerNames = await DBStorage.getTwitchStreamers(guild);
		const streamerName = commandArg[1];
		switch (action) {
			case 'info':
				if (streamerName) {
					const streamer = await this.twitch.findUser(streamerName);
					if (streamer) {
						const stream = await streamer.getStream();
						await this.sendTwitchStreamChangeMessage(guild, msg.channel, streamer, stream);
					} else {
						await msg.channel.send(`${streamerName} not found!`);
					}
				}
				break;
			case 'list':
				if (!isSenderMod) return this.sendNoPermissionMessage(msg);
				await msg.channel.send(`Twitch Streamers: \n${streamerNames.join('\n')}`);
				break;
			case 'add':
				if (!isSenderMod) return this.sendNoPermissionMessage(msg);
				if (streamerName && streamerNames.indexOf(streamerName) < 0) {
					streamerNames = await DBStorage.pushTwitchStreamer(guild, streamerName);
					this.subscribeTwitchStreamChange([streamerName], guild);
					changed = true;
					await msg.channel.send(`Twitch Streamer added: ${streamerName}`);
				} else {
					await msg.channel.send(`Twitch Streamer already on the list: ${streamerName}`);
				}
				break;
			case 'delete':
				if (!isSenderMod) return this.sendNoPermissionMessage(msg);
				if (streamerName && streamerNames.indexOf(streamerName) >= 0) {
					streamerNames = await DBStorage.pullTwitchStreamer(guild, streamerName);
					this.unsubscribeTwitchStreamChange([streamerName], guild);
					changed = true;
					await msg.channel.send(`Twitch Streamer deleted: ${streamerName}`);
				} else {
					await msg.channel.send(`Twitch Streamer is not on the list: ${streamerName}`);
				}
				break;
		}
		if (changed) {
			logger.log(`[bot] twitch_streamers updated: ${JSON.stringify(streamerNames)}`);
		}
	}
	async handleMessageCommandPoll({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		if (emptyCommand) {
			await msg.channel.send(Help.renderCommandUsage('poll', commandPrefix));
			return false;
		}
		// logger.log(msg.author.displayAvatarURL());
		const pollEmbed = new Discord.MessageEmbed({
			footer: {
				text: `${msg.member.displayName}'s Poll`,
				iconUrl: msg.author.displayAvatarURL({
					size: 16,
				}),
			},
			thumbnail: {
				url: msg.author.displayAvatarURL({
					size: 16,
				}),
			}
		});
		const titleAndOptions = commandArgRaw.split(':');
		const options = (titleAndOptions.length > 1 ? titleAndOptions.pop() : titleAndOptions[0]).split(',').map(option => option.trim());
		if (options.length < 2) {
			await msg.channel.send('Poll must include at least two options!');
			return false;
		}
		const title = titleAndOptions[0] || '';
		pollEmbed.setTitle(title);
		pollEmbed.setDescription(options.slice(0, 10).map((o, i) => `${this.findNumberEmoji(i + 1)} - ${o}`));
		const pollMessage = await msg.channel.send(` `, pollEmbed);
		(options).map((o, i) => {
			const emoji = this.findNumberEmoji(i + 1);
			pollMessage.react(`${emoji}`);
		});
	}
	async handleMessageCommandCustom({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		const customPrefixOff = await DBStorage.getGuildSettings(guild, 'customPrefixOff');
		let [commandName, ...content] = commandArgRaw.split(':');
		content = content.join(':');
		switch (action) {
			case 'list':
				const commands = await DBStorage.listCustomCommands(guild);
				// logger.log(`[bot] commands`, commands);
				await msg.channel.send(``, new Discord.MessageEmbed({
					title: 'Custom Commands',
					description: `\n${commands.map(command => `${customPrefixOff ? '' : commandPrefix}${command}`).join('\n')}`
				}));
				break;
			case 'add':
				if (!isSenderMod) return this.sendNoPermissionMessage(msg);
				commandName = commandName.split(' ').slice(1).join(' ').trim();
				// logger.log(`[bot] add custom command ${commandName}: ${content}`);
				if (!command || !content) {
					await msg.channel.send(Help.renderCommandUsage('custom add', commandPrefix));
					return false;
				}
				await DBStorage.setCustomCommand(guild, commandName.trim(), content.trim());
				await msg.channel.send(`Custom command added by ${msg.author.tag}: ${commandName}`);
				break;
			case 'delete':
				if (!isSenderMod) return this.sendNoPermissionMessage(msg);
				commandName = commandName.split(' ').slice(1).join(' ').trim();
				if (!command) {
					await msg.channel.send(Help.renderCommandUsage('custom delete', commandPrefix));
					return false;
				}
				await DBStorage.deleteCustomCommand(guild, commandName);
				await msg.channel.send(`Custom command deleted by ${msg.author.tag}: ${commandName}`);
				break;
			case 'prefix':
				if (!isSenderMod) return this.sendNoPermissionMessage(msg);
				let onOff = commandArg[1];
				let showUsage = false;
				switch (onOff) {
					case 'on': await DBStorage.setGuildSettings(guild, 'customPrefixOff', false); break;
					case 'off': await DBStorage.setGuildSettings(guild, 'customPrefixOff', true); break;
					default:
						showUsage = true;
						onOff = customPrefixOff ? 'off' : 'on';
						break;
				}
				msg.channel.send(`Prefix is now \`${onOff}\` for custom commands.${
					showUsage ? Help.renderCommandUsage('prefix', commandPrefix) : ''
					}`);
		}
	}
	async handleMessageCommandSay({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		if (!isSenderMod) return this.sendNoPermissionMessage(msg);
		await msg.channel.send(commandArgRaw);
		await msg.delete();
	}
	async handleMessageCommandNow({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		const t = Time.nowTZ(commandArgRaw);
		await msg.channel.send(`\`${t}\``);
	}
	async handleMessageCommandRemindMe({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		let [reminderName, ...timeAndTZStringArr] = commandArgRaw.split(':');
		let [timeString = '', timezoneString = ''] = (timeAndTZStringArr || []).join(':').split(',');
		reminderName = reminderName.split(' ').slice(1).join(' ').trim();
		// might be duration text
		const timeIn = Time.timeIn.apply(Time, timeString.trim().split(' '));
		// logger.log(`[bot] remindme timeIn: ${timeIn}`,timeString.trim().split(' '));
		if (timeIn) {
			timeString = Time.format(timeIn);
			// logger.log(`[bot] remindme timeIn: ${timeIn}, string ${timeString}`);
		}
		if (!timezoneString) {
			timezoneString = Time.defaultTZ();
		}
		logger.log(`[bot] remindme ${action}: ${reminderName}, ${timeString}, ${timezoneString}`);
		switch (action) {
			case 'add':
				if (!(reminderName && timeString && timezoneString) || !Time.isValid(timeString)) {
					await msg.channel.send(Help.renderCommandUsage('remindme', commandPrefix));
					return;
				}
				const inThePast = Time.inThePast(Time.m(timeString, timezoneString));
				if (inThePast) {
					return await msg.channel.send(`You can't set a remind me in the past!`);
				}
				await DBStorage.setUserEvent(msg.author.id, reminderName.trim(), timeString.trim(), timezoneString.trim());
				const t = Time.timeTill(timeString.trim(), timezoneString.trim());
				await msg.channel.send(`Remind Me \`${reminderName}\` added.\n\`${t}\``);
				return;
			case 'delete':
				if (!reminderName) {
					await msg.channel.send(Help.renderCommandUsage('remindme', commandPrefix));
					return;
				}
				await DBStorage.deleteUserEvent(msg.author.id, reminderName);
				await msg.channel.send(`Remind Me \`${reminderName}\` removed.`);
				return;
			case 'list':
				const reminders = await DBStorage.listUserEvents(msg.author.id);
				// console.log('reminders',reminders);
				await msg.channel.send(``, new Discord.MessageEmbed({
					title: `Reminders`,
					description: reminders.map(([reminderName, {timeString, timezoneString}]) => `${reminderName}\n\`${timeString} ${timezoneString}\``).join('\n'),
				}));
				return;
		}
	}
	async handleMessageCommandGreet({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		const actionArg = commandArg.slice(1).join(' ');
		switch (action) {
			case 'msg':
				if (!isSenderMod) return this.sendNoPermissionMessage(msg);
				await DBStorage.setGreetingMessage(guild, actionArg.trim());
				await msg.channel.send(`Greeting message set to: \n ${actionArg}`);
				break;
			case 'channel':
				if (!isSenderMod) return this.sendNoPermissionMessage(msg);
				if (actionArg) {
					const channelId = actionArg;
					const channel = guild.channels.cache.get(channelId);
					if (channel) {
						await DBStorage.setGreetingChannel(guild, channelId);
						await msg.channel.send(`Greeting message channel set to: <#${channel.id}>`);
					} else {
						await msg.channel.send(`Greeting message channel not set: channel id ${channelId} invalid.`);
					}
				} else {
					const {channelId} = await DBStorage.getGreetingMessage(guild);
					const channel = guild.channels.cache.get(channelId);
					if (channel) {
						await msg.channel.send(`Greeting message channel set to: <#${channel.id}>`);
					} else {
						await msg.channel.send(`Greeting message channel not set.`);
					}
				}
				break;
			default:
				const {message} = await DBStorage.getGreetingMessage(guild);
				if (message) {
					await msg.channel.send(message);
				}
				break;
		}
	}
	async handleMessageCommandReminder({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		if (!isSenderMod) return this.sendNoPermissionMessage(msg);
		let [reminderName, ...timeAndTZStringArr] = commandArgRaw.split(':');
		let [timeString = '', timezoneString = ''] = (timeAndTZStringArr || []).join(':').split(',');
		reminderName = reminderName.split(' ').slice(1).join(' ').trim();
		// might be duration text
		const timeIn = Time.timeIn.apply(Time, timeString.trim().split(' '));
		// logger.log(`[bot] reminder timeIn: ${timeIn}`);
		if (timeIn) {
			timeString = Time.format(timeIn);
		}
		if (!timezoneString) {
			timezoneString = Time.defaultTZ();
		}
		// logger.log(`[bot] reminder ${action}: ${reminderName}, ${timeString}, ${timezoneString}`);
		switch (action) {
			case 'add':
				if (!(reminderName && timeString && timezoneString) || !Time.isValid(timeString)) {
					await msg.channel.send(Help.renderCommandUsage('reminder', commandPrefix));
					return;
				}
				const inThePast = Time.inThePast(Time.m(timeString, timezoneString));
				if (inThePast) {
					return await msg.channel.send(`You can't set a remind me in the past!`);
				}
				await DBStorage.setReminder(guild, msg.channel.id, reminderName.trim(), timeString.trim(), timezoneString.trim());
				const t = Time.timeTill(timeString.trim(), timezoneString.trim());
				await msg.channel.send(`Reminder \`${reminderName}\` added.\n\`${t}\``);
				return;
			case 'delete':
				if (!reminderName) {
					await msg.channel.send(Help.renderCommandUsage('reminder', commandPrefix));
					return;
				}
				await DBStorage.deleteReminder(guild, reminderName);
				await msg.channel.send(`Reminder \`${reminderName}\` removed.`);
				return;
			case 'list':
				const reminders = await DBStorage.listReminders(guild);
				await msg.channel.send(``, new Discord.MessageEmbed({
					title: `Reminders`,
					description: Object.keys(reminders).map(reminderName=>{
						const {timeString,timezoneString} = reminders[reminderName];
						return `${reminderName}\n\`${timeString} ${timezoneString}\``;
					}).join('\n'),
				}));
				return;
			default:
				// look up saved reminder
				[reminderName] = commandArgRaw.split(':');
				({timeString, timezoneString} = await DBStorage.getReminder(guild, reminderName));
				if (timeString && timezoneString) {
					// logger.log('[bot] reminder found',reminderName,timeString,timezoneString);
					const t = Time.timeTill(timeString.trim(), timezoneString.trim());
					await msg.channel.send(`\`${reminderName}\`\n\`${t}\``);
				}
				break;
		}
	}
	async handleMessageCommandTimeTill({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		let [eventName, ...timeAndTZStringArr] = commandArgRaw.split(':');
		let [timeString = '', timezoneString = ''] = (timeAndTZStringArr || []).join(':').split(',');
		// logger.log('[bot] timetill',eventName,timeString,timezoneString);
		let prefix = '';
		switch (action) {
			case 'add':
			case 'delete':
				if (!isSenderMod) return this.sendNoPermissionMessage(msg);
				eventName = eventName.split(' ').slice(1).join(' ').trim();
				// logger.log('[bot] timetill add/delete event',eventName,timeString,timezoneString);
				if (action == 'add') {
					if (!(eventName && timeString && timezoneString)) {
						await msg.channel.send(Help.renderCommandUsage('timetill [add|delete]', commandPrefix));
						return;
					}
					await DBStorage.setReminder(guild, eventName.trim(), timeString.trim(), timezoneString.trim());
					prefix = `Event \`${eventName}\` added.\n`;
				} else {
					if (!eventName) {
						await msg.channel.send(Help.renderCommandUsage('timetill [add|delete]', commandPrefix));
						return;
					}
					await DBStorage.deleteReminder(guild, eventName);
					await msg.channel.send(`Event \`${eventName}\` removed.`);
					return;
				}
				break;
			case 'list':
				const events = await DBStorage.listReminders(guild);
				await msg.channel.send(``, new Discord.MessageEmbed({
					title: `Events`,
					description: events.map(([event, [time, tz]]) => `${event}\n\`${time} ${tz}\``).join('\n'),
				}));
				return;
				break;
			default:
				// look up saved timetill event
				eventName = eventName.trim();
				[timeString, timezoneString] = await DBStorage.getReminder(guild, eventName);
				if (!(timeString && timezoneString)) {
					[timeString, timezoneString] = commandArgRaw.split(',');
					// logger.log(`[bot] timetill regular look up from [${commandArgRaw}]: [${timeString}],[${timezoneString}]`);
				} else {
					prefix = `\`${eventName}\`\n`;
					// logger.log('[bot] timetill event found',eventName,timeString,timezoneString);
				}
				break;
		}
		if (!(timeString && timezoneString)) {
			await msg.channel.send(Help.renderCommandUsage('timetill', commandPrefix));
			return;
		}
		const t = Time.timeTill(timeString.trim(), timezoneString.trim());
		await msg.channel.send(`${prefix}\`${t}\``);
	}
	async handleMessageCommandWikia({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		const [w, ...q] = commandArgRaw.split(':');
		if (emptyCommand || q.length == 0) {
			await msg.channel.send(Help.renderCommandUsage('wikia', commandPrefix));
			return false;
		}
		const wikia = new Wikia();
		const result = await wikia.search(w, q.join(':'));
		if (result) {
			await msg.channel.send(result.url);
		} else {
			await msg.channel.send(`Result not found for ${w}: ${q.join(':')}`);
		}
	}
	async handleMessageCommandRole({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		if (!isSenderMod) return this.sendNoPermissionMessage(msg);
		if (emptyCommand) {
			await msg.channel.send(Help.renderCommandUsage('role', commandPrefix));
		}
		const roleId = commandArg[1];
		const emoji = commandArg[2];
		switch (action) {
			case 'add': {
				if (!roleId) {
					await msg.channel.send(Help.renderCommandUsage('role', commandPrefix));
					break;
				}
				const role = msg.guild.roles.cache.find(r => r.id == roleId);
				if (!role) {
					await msg.channel.send(`Role not found.`);
					break;
				}
				await DBStorage.addRoleAssignment(guild, roleId, emoji);
				await msg.channel.send(`Role added for react assignment: ${role.name} (emoji: ${emoji})`);
			}
				break;
			case 'delete': {
				if (!roleId) {
					await msg.channel.send(Help.renderCommandUsage('role', commandPrefix));
					break;
				}
				const role = msg.guild.roles.cache.find(r => r.id == roleId);
				if (!role) {
					await msg.channel.send(`Role not found.\``);
					break;
				}
				await DBStorage.deleteRoleAssignment(guild, roleId);
				await msg.channel.send(`Role deleted for react assignment: ${role.name}`);
			}
				break;
			case 'list': {
				const roleAssignments = await DBStorage.listRoleAssignments(guild);
				const roleAssignMapById = roleAssignments.reduce((map, role) => {
					map[role.roleId] = role;
					return map;
				}, {});
				const roles = await msg.guild.roles.cache.filter(role => !role.name.startsWith('@') && !role.managed && !role.deleted).map(role => {
					const assignedRole = roleAssignMapById[role.id];
					return {
						id: role.id,
						name: role.name,
						emoji: assignedRole ? assignedRole.emoji : '\`[]\`',
					}
				});
				const roleMessageEmbed = new Discord.MessageEmbed({
					title: 'Roles for react assignment',
					description: `${roles.map(r => `${r.emoji} - <@&${r.id}> (\`${r.id}\`)`).join('\n')}`
				});
				await msg.channel.send('', roleMessageEmbed);
			}
				break;
			case 'post': {
				const deleteOld = commandArg[1] == 'new';
				const {channelId, messageId} = await DBStorage.getRoleAssignmentMessage(guild);
				let roleMessage = null;
				if (channelId && messageId) {
					try {
						const postChannel = await guild.channels.cache.get(channelId);
						roleMessage = await postChannel.messages.fetch(messageId);
						logger.log(`[bot] found old role message in ${postChannel.name}`);
						if (deleteOld) {
							await roleMessage.delete();
							roleMessage = null;
							logger.log(`[bot] delete old role message in ${postChannel.name}`);
						}
					} catch (error) {
						// logger.log(`[bot] find old role message error:`,error);
					}
				}
				const roles = await DBStorage.listRoleAssignments(guild);
				const roleMessageEmbed = new Discord.MessageEmbed({
					title: 'React to get a role!',
					description: `${roles.map(r => `${r.emoji} - <@&${r.role.id}>`).join('\n')}`
				});
				if (roleMessage == null) {
					roleMessage = await msg.channel.send(``, roleMessageEmbed);
				} else {
					roleMessage = await roleMessage.edit(``, roleMessageEmbed);
				}
				Object.keys(roles).map((key, i) => {
					let emoji = roles[key].emoji;
					try { if (emoji && emoji.split) emoji = emoji.split(':')[2].split('>')[0]; } catch (err) { }
					roleMessage.react(emoji || this.findNumberEmoji(i));
				});
				await DBStorage.setRoleAssignmentMessage(guild, roleMessage.channel.id, roleMessage.id);
				this.addRoleListener(guild, roleMessage.channel.id, roleMessage.id);
				msg.delete();
			}
				break;
		}
	}
	async handleMessageCommandRoll({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		try {
			let sides = parseInt((commandArg[0] || '').trim());
			if (!Number.isInteger(sides)) {
				sides = 6;
			}
			const roll = Misc.roll(sides);
			const suffix = sides == 6 ? '' : ` from a d${sides}`;
			await msg.channel.send(`<@${msg.author.id}>, you rolled a ${roll}${suffix}!`);
		} catch (error) {
			await msg.channel.send(`${error}`);
		}
	}
	async handleMessageCommandFlip({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		const roll = Misc.flip();
		await msg.reply(`${roll == 0 ? 'Heads' : 'Tails'}!`);
	}
	async handleMessageCommandMinesweeper({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		const [x = 8, y = 8, ratio = 0.10] = commandArg;
		const minesweeper = new Minesweeper(parseInt(x), parseInt(y), parseFloat(ratio));
		const board = minesweeper.render();
		await msg.channel.send(`${board}`);
	}
	async handleMessageCustomCommand({ msg, isSenderAdmin, isSenderMod, command, commandArg, commandArgRaw, emptyCommand, action, guild, commandPrefix }) {
		// logger.log(`[bot] checking custom command for ${guild.name}: ${command}`);
		const m = await DBStorage.getCustomCommand(guild, command);
		if (m) {
			await msg.channel.send(m);
		}
	}
	// handle reactions
	async handlePartialMessage(message) {
		if (message.partial) {
			try {
				await message.fetch();
			} catch (error) {
				logger.error('Something went wrong when fetching the message: ', error);
				return false;
			}
		}
		return true
	}
	async handleMessageReactionAdd(msgReact, user) {
		if (!(await this.handlePartialMessage(msgReact))) return;
		if (user.id == this.bot.user.id) return;
		const { message, emoji, me } = msgReact;
		const { guild, channel } = message;
		// logger.log(`[bot] handleMessageReactionAdd ${guild}, ${channel.id}, ${message.id}`);
		this._roleListeners.map(async (arr) => {
			const [guildId, channelId, messageId] = arr;
			if (guild.id == guildId && channel.id == channelId && message.id == messageId) {
				await this.handleRoleAssignment(guild, user, emoji, true);
			}
		});
		// handle help message
		let helpMessagePage = this.session[guild.id].helpMessages[message.id];
		if (helpMessagePage != undefined) {
			switch (emoji.name) {
				case '▶': helpMessagePage++; break;
				case '◀': helpMessagePage--; break;
			}
			this.renderMessageCommandHelp(message, helpMessagePage);
			msgReact.users.remove(user.id);
		}
	}
	async handleMessageReactionRemove(msgReact, user) {
		if (!(await this.handlePartialMessage(msgReact))) return;
		if (user.id == this.bot.user.id) return;
		const { message, emoji, me } = msgReact;
		const { guild, channel } = message;
		// logger.log(`[bot] handleMessageReactionRemove ${guild}, ${channel.id}, ${message.id}`);
		this._roleListeners.map(async (arr) => {
			const [guildId, channelId, messageId] = arr;
			if (guild.id == guildId && channel.id == channelId && message.id == messageId) {
				await this.handleRoleAssignment(guild, user, emoji, false);
			}
		})
	}
}


module.exports = Bot;