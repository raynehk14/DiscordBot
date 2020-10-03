'use strict';
const axios = require('axios');

class Wikia {
	constructor(){

	}
	async findWikia(query){
		const ret = await axios.get('https://www.wikia.com/api/v1/Wikis/ByString?limit=1&batch=1&includeDomain=true&string='+query);
		if(ret&&ret.data&&ret.data.items){
			const [wikia] = ret.data.items;
			return wikia;
		}
		return null;
	}
	async search(wikiaQuery,query){
		const wikia = await this.findWikia(wikiaQuery);
		if(wikia){
			const {name,domain} = wikia;
			const ret = await axios.get('https://'+domain+'/api/v1/Search/List?limit=1&minArticleQuality=10&batch=1&namespaces=0%2C14&query='+query);
			if(ret&&ret.data&&ret.data.items){
				const [item] = ret.data.items;
				return item;
			}
		}
		return null;
	}
}
module.exports = Wikia;