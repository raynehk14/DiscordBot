'use strict';
const moment = require('moment');
const momentTZ = require('moment-timezone');
moment.suppressDeprecationWarnings = true;

const TZ_LIST = moment.tz.names().map(key=>({zone:moment.tz.zone(key),abbr:moment().tz(key).format('z').toLowerCase()}));
const Time = {
	nowTZ: (q)=>{
		let tzText; let suffix = '';
		if(q){
			const tz = Time.guessTZ(q);
			if(tz) tzText = tz.name;
		}
		if(!tzText){
			tzText = moment.tz.guess();
			suffix = '[ (Server Time)]';
		}
		return moment().tz(tzText).format(`YYYY-MM-DD HH:mm Z(z)${suffix}`);
	},
	guessTZ: (q)=>{
		if(!q) return null;
		q = q.trim().replace(/ /g,'_').toLowerCase();
		const matches = TZ_LIST.filter(tz=>{
				const {zone,abbr} = tz;
				const [region,area] = zone.name.split('/');
				return tz.abbr==q||region.toLowerCase()==q||(area&&area.toLowerCase().indexOf(q)>=0);
		});
		return matches[0]&&matches[0].zone;
	},
	defaultTZ:()=>{
		return 'GMT';//moment.tz.guess();
	},
	timeIn(value,unit){
		const duration = moment.duration(value,unit);
		if(duration.asMinutes()==0) return null; // ignore durations under 1 minute
 		return moment().add(duration);
	},
	timeTill(ts,zs){
    const target = Time.m(ts,zs);
		if(!target.isValid()) return 'Invalid Date';
    const now = moment();
    return `${target.format(`YYYY-MM-DD HH:mm Z(z)`)} is ${Time.relativeTimeReadable(now,target)}`;
	},
	relativeTimeReadable(now,target){
			const ds = target.diff(now,'seconds');
			const relative = ds<0?-1:ds>0?1:0;
			if(relative==0) return 'Now';
      const raws = Math.abs(ds);
			const rawm = Math.floor(raws/60);
			const rawh = Math.floor(rawm/60);
			const rawd = Math.floor(rawh/24);
			const prefix = relative>0?'in ':'';
			const suffix = relative<0?' ago':'';
			const s = raws%60;
			const m = rawm%60;
			const h = rawh%24;
			const d = rawd;
			const dayString = d>0?`${d} day${d>1?'s':''} `:'';
			const hourString = h>0?`${h} hour${h>1?'s':''} `:'';
			const minuteString = m>0?`${m} minute${m>1?'s':''} `:'';
			const secondString = s>0?`${s} second${s>1?'s':''} `:'';
			return `${prefix}${dayString}${hourString}${minuteString}${secondString}${suffix}`.replace(/  /g,' ').trim();
	},
	m(ts,zs){
    const zone = Time.guessTZ(zs);
		// console.log('[time] timetill timezone guess', zone&&zone.name)
    return moment.tz(ts,zone&&zone.name||moment.tz.guess());
	},
	now(){
		return moment();
	},
	msTilNextRoundMinute(){
		return moment().add(1,'m').seconds(0).diff(moment(),'ms');
	},
	format(m){
		return m&&m.format(`YYYY-MM-DD HH:mm`);
	},
	inThePast(m){
		return moment().isSameOrAfter(m);
	},
	isSameDay(m){
		return moment().isSame(m,'day');
	},
	isValid(str){
		try {
			return moment(str).isValid();
		}catch(error){
			return false;
		}
	},
}
module.exports = Time;