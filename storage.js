'use strict';
const Database = require("@replit/database");
class Storage{
	constructor(){
		this.storage = new Database();
	}
	async get(guild,key){
		const storeKey = getStoreKey(guild,key);
		return await this.storage.get(storeKey);
	}
	async set(guild,key,value){
		const storeKey = getStoreKey(guild,key);
		return await this.storage.set(storeKey,value);
	}
	async delete(guild,key){
		const storeKey = getStoreKey(guild,key);
		return await this.storage.delete(storeKey);
	}
	async list(prefix){
		return await this.storage.list(prefix);
	}
	async deleteWithPrefix(prefix){
		const keys = await this.storage.list(prefix);
		keys.map(key=>{
			// console.log(`[storage] deleting key ${key}`);
			this.storage.delete(encodeURI(key));
		});
	}
	// guild settings
	async getGuildSettings(guild,key){
		let settings = {};
		try{
			const str = await this.get(guild,'settings');
			settings = JSON.parse(str||'{}');
		}catch(err){
			await this.set(guild,'roles',JSON.stringify(settings));
		}
		if(key){
			return settings[key];
		}
		return settings;
	}
	async setGuildSettings(guild,key,value){
		const settings = await this.getGuildSettings(guild);
		settings[key] = value;
		return await this.set(guild,'settings',JSON.stringify(settings));
	}
	async deleteGuildSettings(guild,key){
		const settings = await this.getGuildSettings(guild);
		delete settings[key];
		return await this.set(guild,'settings',JSON.stringify(settings));
	}

	// feature specific commands
	// twitch streamer subscriptions
	async getTwitchStreamers(guild){
		let twitchStreamers = [];
		try{
			const str = await this.get(guild,'twitch_streamers');
			twitchStreamers = JSON.parse(str||'[]');
		}catch(err){
			await this.set(guild,'twitch_streamers',JSON.stringify(twitchStreamers));
		}
		return twitchStreamers;
	}
	// custom command
	async getCustomCommand(guild,command){
		return await this.get(guild,`custom:${command}`);
	}
	async setCustomCommand(guild,command,message){
		return await this.set(guild,`custom:${command}`,message);
	}
	async deleteCustomCommand(guild,command){
		return await this.delete(guild,`custom:${command}`);
	}
	async listCustomCommands(guild){
		return (await this.list(getStoreKey(guild,'custom'))).map(key=>key.split(':')[2]);
	}
	// reminders
	async getReminder(userId,reminderName){
		const string = await this.get('',`reminders:${userId}:${reminderName}`);
		if(string){
			return string.split(',');
		}
		return [];
	}
	async setReminder(userId,reminderName,timeString,timezoneString){
		return await this.set('',`reminders:${userId}:${reminderName}`,`${timeString},${timezoneString}`);
	}
	async deleteReminder(userId,reminderName){
		return await this.delete('',`reminders:${userId}:${reminderName}`);
	}
	async listReminders(userId){
		return Promise.all((await this.list(getStoreKey('',`reminders:${userId}`))).map(async key=>{
			const reminderName = key.split(':')[3];
			const time = await this.getReminder(userId,reminderName);
			return [reminderName,time];
		}));
	}
	async listUsersWithReminders(guild){
		return Promise.all((await this.list(getStoreKey('',`reminders`))).map(async key=>{
			// console.log(`[storage] list guild users key ${key}`);
			const [emptyGuildId,reminderText,userId,reminderName] = key.split(':');
			const reminder = await this.getReminder(userId,reminderName);
			return [userId,[reminderName,reminder]];
		}));
	}
	// timetill events
	async getTimeTillEvent(guild,eventName){
		const string = await this.get(guild,`timetill:${eventName}`);
		if(string){
			return string.split(',');
		}
		return [];
	}
	async setTimeTillEvent(guild,eventName,timeString,timezoneString){
		return await this.set(guild,`timetill:${eventName}`,`${timeString},${timezoneString}`);
	}
	async deleteTimeTillEvent(guild,eventName){
		return await this.delete(guild,`timetill:${eventName}`);
	}
	async listTimeTillEvents(guild){
		return (await this.list(getStoreKey(guild,'timetill'))).map(key=>key.split(':')[2]);
	}
	// role assignments
	async getRoleAssignment(guild,roleId){
		let roleMap = {};
		try{
			const str = await this.get(guild,'roles');
			roleMap = JSON.parse(str||'{}');
		}catch(err){
			await this.set(guild,'roles',JSON.stringify(roleMap));
		}
		return roleMap;
	}
	async getRoleAssignmentByEmoji(guild,emoji){
		// console.log(`[store] get emoji`,emoji);
		const roleMap = await this.getRoleAssignment(guild,'roles');
		for(let i=0,roleId;roleId=Object.keys(roleMap)[i];i++){
			const roleEmoji = roleMap[roleId];
			// console.log('[store] compare role emojis:',emoji.id,emoji.name,roleEmoji);
			if(roleEmoji==emoji.id||roleEmoji==emoji.name||roleEmoji==`<:${emoji.name}:${emoji.id}>`){
				return await guild.roles.fetch(roleId);
			}
		}
		return null;
	}
	async addRoleAssignment(guild,roleId,emoji){
		const roleMap = await this.getRoleAssignment(guild,'roles');
		roleMap[roleId] = emoji||false;
		return await this.set(guild,'roles',JSON.stringify(roleMap));
	}
	async deleteRoleAssignment(guild,roleId){
		const roleMap = await this.getRoleAssignment(guild,'roles');
		delete roleMap[roleId];
		return await this.set(guild,'roles',JSON.stringify(roleMap));
	}
	async listRoleAssignments(guild){
		const roleMap = await this.getRoleAssignment(guild,'roles');
		const roleList = [];
		for(let i=0,roleId;roleId=Object.keys(roleMap)[i];i++){
			roleList.push({
				roleId:roleId,
				role:await guild.roles.fetch(roleId),
				emoji:roleMap[roleId]
			});
		}
		return roleList;
	}
	async getRoleAssignmentMessage(guild){
		const value = await this.get(guild,'roleMessage');
		return (value||'').split(':');
	}
	async setRoleAssignmentMessage(guild,channelId,messageId){
		return await this.set(guild,'roleMessage',`${channelId}:${messageId}`);
	}
}
function getStoreKey(guild,key){
	// console.log(`[store] get key ${guild}, ${key}`);
	if(!guild){
		guild = '';
	}else if(typeof guild=='object'){
		guild = guild.id||guild;
	}
	return encodeURI(`${guild}:${key}`);
}

module.exports = Storage;