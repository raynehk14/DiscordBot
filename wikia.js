'use strict';
const axios = require('axios');
const cheerio = require('cheerio');

class Wikia {
	constructor(){

	}
	async findWikia(query){
		try{
			const url = 'https://www.wikia.com/api/v1/Wikis/ByString?limit=1&batch=1&includeDomain=true&string='+query.trim();
			console.log(`[wikia] searching wikia ${query}: ${url}`);
			const ret = await axios.get(url);
			if(ret&&ret.data&&ret.data.items){
				const [wikia] = ret.data.items;
				return wikia;
			}
		}catch(error){
			console.log(`[wikia] error during wikia lookup: ${query}`,error);
			// throw error;
		}
		return null;
	}
	async search(wikiaQuery,query){
		const wikia = await this.findWikia(wikiaQuery);
		if(wikia){
			const {name,domain} = wikia;
			try{
				const url = `https://${domain}/api/v1/Search/List?limit=1&minArticleQuality=10&batch=1&namespaces=0%2C14&query=${query.trim()}`;
				console.log(`[wikia] searching ${wikiaQuery}: ${url}`);
				const ret = await axios.get(url);
				if(ret&&ret.data&&ret.data.items){
					const [item] = ret.data.items;
					return item;
				}
			}catch(error){
				console.log(`[wikia] error during wikia ${wikiaQuery} search: ${query}`,error.response.data.status);
				if(error.response.data.error=='ControllerNotFoundException'){
					// return {url:`${name} wikia does not support API search!`};
					// backup search: browser page & parse html
					const url = `https://${domain}/wiki/Special:Search?scope=internal&navigationSearch=true&query=${query.trim()}`;
					console.log(`[wikia] searching html ${wikiaQuery}: ${url}`);
					const ret = await axios.get(url);
					if(ret&&ret.status==200){
						const $ = cheerio.load(ret.data);
						const a = $('a[data-page-id]');
						const result = Object.assign({url:a.attr('href')},a.data());
						// console.log(result);
						return result;
					}
				}
				// throw error;
			}
		}
		return null;
	}
}
module.exports = Wikia;