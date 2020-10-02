'use strict';
const { YoutubeDataAPI } = require("youtube-v3-api");
const moment = require('moment');

const YOUTUBE_API = process.env.YOUTUBE_API;

class Youtube {
	// cache search results for one hour
	constructor(storage){
		this.api = new YoutubeDataAPI(YOUTUBE_API);
		this.storage = storage;
		this.cleanUpCache();
	}
	async cleanUpCache(){
		await this.storage.deleteWithPrefix(`youtube:`);
	}
	async search(search){
		const cachedUrl = await this.searchFromCache(search);
		if(cachedUrl){
			// console.log(`[youtube] found result from cache ${cachedUrl}`);
			return cachedUrl;
		}else{
			const results = await this.api.searchAll(search,1);
			const { items } = results;
			const [ item ] = items;
			const youtubeVideoItem = new YoutubeVideoItem(item);
			const url = youtubeVideoItem.getVideoUrl();
			this.saveSearchCache(search,url);
			// console.log(`[youtube] found result ${url}`);
			return url;
		}
	}
	async saveSearchCache(search,url){
		const ts = moment(Date.now()).format('YYYYMMDDhh');
		await this.storage.set('youtube',`${search}:${ts}`,url);
	}
	async searchFromCache(search){
		const ts = moment(Date.now()).format('YYYYMMDDhh');
		return await this.storage.get('youtube',`${search}:${ts}`);
	}
}

class YoutubeVideoItem {
	constructor(item){
		const { title, description } = item.snippet;
		this.id = item.id.videoId;
		this.title = title;
		this.description = description;
	}
	getVideoUrl(){
		return `https://youtu.be/${this.id}`;
	}
}

module.exports = Youtube;
