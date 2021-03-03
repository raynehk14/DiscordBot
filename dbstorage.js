'use strict';
const axios = require('axios');
const API_BASE = process.env.DB_API_BASE;
const API_AUTH_TOKEKN = process.env.DB_AUTH_TOKEN;
const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
  headers: {'authorization': `Bearer ${API_AUTH_TOKEKN}`}
});
class DBStorage {
	constructor(){}
	handleError(error){
		console.trace(`[axios] error on ${error&&error.config&&error.config.url}`);
		throw error;
	}
	async setGuildName({id:guildId,name}){
		await api.post(API_BASE+'/name',{guildId,name}).catch(this.handleError);
	}
	// guild settings
	async getGuildSettings({id:guildId},key){
		const ret = await api.get(API_BASE+'/settings',{params:{guildId}}).catch(this.handleError);
		return ret&&ret.data&&ret.data[key];
	}
	async setGuildSettings({id:guildId},key,value){
		const ret = await api.post(API_BASE+'/settings',{guildId,key,value}).catch(this.handleError);
	}
	async deleteGuildSettings({id:guildId},key){
		const ret = await api({method:'DELETE',url:API_BASE+'/settings',data:{guildId,key}}).catch(this.handleError);
	}

	// feature specific commands
	// twitch streamer subscriptions
	async getTwitchStreamers({id:guildId}){
		const ret = await api.get(API_BASE+'/twitchStreamers',{params:{guildId}}).catch(this.handleError);
		return ret&&ret.data;
	}
	async pushTwitchStreamer({id:guildId},streamerName){
		const ret = await api.post(API_BASE+'/twitchStreamer',{guildId,streamerName}).catch(this.handleError);
		return ret&&ret.data;
	}
	async pullTwitchStreamer({id:guildId},streamerName){
		const ret = await api({method:'DELETE',url:API_BASE+'/twitchStreamer',data:{guildId,streamerName}}).catch(this.handleError);
		return ret&&ret.data;
	}
	// custom command
	async getCustomCommand({id:guildId},key){
		const ret = await api.get(API_BASE+'/commands',{params:{guildId}}).catch(this.handleError);
		return ret&&ret.data&&ret.data[key];
	}
	async setCustomCommand({id:guildId},key,value){
		const ret = await api.post(API_BASE+'/command',{guildId,key,value}).catch(this.handleError);
		return ret&&ret.data;
	}
	async deleteCustomCommand({id:guildId},key){
		const ret = await api({method:'DELETE',url:API_BASE+'/command',data:{guildId,key}}).catch(this.handleError);
		return ret&&ret.data;
	}
	async listCustomCommands({id:guildId}){
		const ret = await api.get(API_BASE+'/commands',{params:{guildId}}).catch(this.handleError);
		const commands = ret&&ret.data;
		return Object.keys(commands);
	}
	// reminders (events)
	async getReminder({id:guildId},key){
		const ret = await api.get(API_BASE+'/events',{params:{guildId}}).catch(this.handleError);
		return ret&&ret.data&&ret.data[key];
	}
	async setReminder({id:guildId},channelId,key,timeString,timezoneString){
		const ret = await api.post(API_BASE+'/event',{guildId,key,channelId,timeString,timezoneString}).catch(this.handleError);
		return ret&&ret.data&&ret.data;
	}
	async deleteReminder({id:guildId},key){
		const ret = await api({method:'DELETE',url:API_BASE+'/event',data:{guildId,key}}).catch(this.handleError);
		return ret&&ret.data;
	}
	async listReminders({id:guildId}){
		const ret = await api.get(API_BASE+'/events',{params:{guildId}}).catch(this.handleError);
		return ret&&ret.data;
	}
	// greeting message
	async getGreetingMessage({id:guildId}){
		const ret = await api.get(API_BASE+'/greet',{params:{guildId}}).catch(this.handleError);
		return ret&&ret.data||{};
	}
	async setGreetingMessage({id:guildId},message){
		const ret = await api.post(API_BASE+'/greet',{guildId,message:message.trim()}).catch(this.handleError);
		return ret&&ret.data&&ret.data;
	}
	async setGreetingChannel({id:guildId},channelId){
		const ret = await api.post(API_BASE+'/greet/channel',{guildId,channelId}).catch(this.handleError);
		return ret&&ret.data&&ret.data;
	}
	// role assignments
	async getRoleAssignment({id:guildId}){
		const ret = await api.get(API_BASE+'/roles',{params:{guildId}}).catch(this.handleError);
		return ret&&ret.data||{};
	}
	async getRoleAssignmentByEmoji(guild,emoji){
		const roleMap = await this.getRoleAssignment(guild);
		for(let i=0,roleId;roleId=Object.keys(roleMap)[i];i++){
			const roleEmoji = roleMap[roleId];
			// console.log('[store] compare role emojis:',emoji.id,emoji.name,roleEmoji);
			if(roleEmoji==emoji.id||roleEmoji==emoji.name||roleEmoji==`<:${emoji.name}:${emoji.id}>`){
				return await guild.roles.fetch(roleId);
			}
		}
		return null;
	}
	async addRoleAssignment({id:guildId},roleId,emoji){
		const ret = await api.post(API_BASE+'/role',{guildId,roleId,emoji}).catch(this.handleError);
		return ret&&ret.data;
	}
	async deleteRoleAssignment({id:guildId},roleId){
		const ret = await api({method:'DELETE',url:API_BASE+'/role',data:{guildId,roleId}}).catch(this.handleError);
		return ret&&ret.data;
	}
	async listRoleAssignments(guild){
		const roleMap = await this.getRoleAssignment(guild);
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
	async getRoleAssignmentMessage({id:guildId}){
		const ret = await api.get(API_BASE+'/role/message',{params:{guildId}}).catch(this.handleError);
		return ret&&ret.data||{};
	}
	async setRoleAssignmentMessage({id:guildId},channelId,messageId){
		const ret = await api.post(API_BASE+'/role/message',{guildId,channelId,messageId}).catch(this.handleError);
		return ret&&ret.data;
	}
	// user level
	// remind mes (user events)
	async getUserEvents(userId){
		const ret = await api.get(API_BASE+'/user/events',{params:{userId}}).catch(this.handleError);
		return ret&&ret.data||{};
	}
	async setUserEvent(userId,key,timeString,timezoneString){
		const ret = await api.post(API_BASE+'/user/event',{userId,key,timeString,timezoneString}).catch(this.handleError);
		return ret&&ret.data;
	}
	async deleteUserEvent(userId,key){
		const ret = await api({method:'DELETE',url:API_BASE+'/user/event',data:{userId,key}}).catch(this.handleError);
		return ret&&ret.data;
	}
	async listUserEvents(userId){
		const userEvents = await this.getUserEvents(userId);
		return Object.keys(userEvents).map(key=>{
			const reminderName = key;
			const reminder = userEvents[key];
			return [reminderName,reminder];
		});
	}
	async listUsersWithEvents(userId){
		const ret = await api.get(API_BASE+'/users/withEvents',{params:{userId}}).catch(this.handleError);
		return ret&&ret.data||{};
	}
}

module.exports = new DBStorage();