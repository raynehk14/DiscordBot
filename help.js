const Help = {
	list: {
		'now':{
			command:'now [tz(optional)]',
			desc:'Current Local Time.  \nNote that query uses tz database/abbreviations so only cities/regions in the database would return a result.  Fallbacks to displaying server time.\ne.g. \`${commandPrefix}now new york\`, \`${commandPrefix}now est\`',
		},
		'timetill':{
			command:'timetill [time(YYYY-DD-MM hh:mm)], [tz]',
			desc:'Time till the input date.\ne.g. \`${commandPrefix}timetill 2049-10-03 20:49, los angeles\`',
		},
		'reminder':{
			command:'reminder [add|delete|list] [reminder name(optional)]: [time(YYYY-DD-MM hh:mm)|duration], [tz]',
			desc:'Set a global reminder (via DM)\ne.g. \`${commandPrefix}reminder add Escape RC: 1998-10-30 10:00, CDT\`\n${commandPrefix}reminder check the oven: 1 hour',
		},
		'poll':{
			command:'poll [Title of your poll(optional)]: [option1], [option2], ...',
			desc:'Start a poll',
		},
		'roll':{
			command:'roll [number of sides(optional, default: 6)]',
			desc:'Roll a dice (d4,d6,d8,d10,d20)',
		},
		'flip':{
			command:'flip',
			desc:'Flip a coin',
		},
		'mine':{
			command:'mine [width(optional)] [height(optional)] [mine ratio/count(optional)]',
			desc:'Create a minesweeper board.  Default board is 5x5 with 5% mines, max size is 10x10.\ne.g. \`${commandPrefix}mine 10 10 15\` for 10x10 board with 15 mines\n\`${commandPrefix}mine 5 5 0.5\` for 5x5 board with 5% mines',
		},
		'youtube':{
			command:'youtube [query]',
			desc:'Search youtube for a video',
		},
		'wikia':{
			command:'wikia [wikia name]: [query]',
			desc:'Search wikia for an article\ne.g. \`${commandPrefix}wikia resident evil: claire redfield\`',
		},
		'twitch':{
			command:'twitch info [streamer name]',
			desc:'Check a twitch streamer\' current stream status',
		},
		'custom':{
			command:'custom list',
			desc:'List of this server\'s custom commands',
		},
		'custom add':{
			command:'custom add [trigger phrase]: [message]',
			desc:'Create a custom command',
			mod: true,
		},
		'prefix':{
			command:'prefix [new command prefix]',
			desc:'Change the command prefix (default: \`!\`)',
			mod: true,
		},
	},
	pageLimit: 3,
	getPage:(page)=>{
		const list = Object.keys(Help.list);
		const start = page*Help.pageLimit;
		const end = (page+1)*Help.pageLimit;
		return list.slice(start,end).map(key=>Help.list[key]);
	},
	getPageCount:()=>Math.ceil(Object.keys(Help.list).length/Help.pageLimit),
	getCommand:(command)=>{
		return Help.list[command];
	},
	renderHelp:(help,commandPrefix='!')=>{
		const {command,desc} = help||{command:'',desc:''};
		return `\`${commandPrefix}${command}\`\n${(desc||'').replace(/\$\{commandPrefix\}/,commandPrefix)}`;
	},
}
module.exports = Help;