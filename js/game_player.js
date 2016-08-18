/*
*	描述：game_player信息类
*	作者：张亚磊
*	时间：2016/02/24
*/

function Game_Player() {
	this.sync_player_data_tick = util.now_sec();
	this.gate_cid = 0;
	this.player_cid = 0;
	this.cplayer = null;
	this.is_change = false;
	this.player_info = new Game_Player_Info();
	this.hero = new Hero();
	this.bag = new Bag();
	this.mail = new Mail();
}

//玩家上线，加载数据
Game_Player.prototype.load_player_data = function(gate_cid, player_cid, obj) {
	print('***************game_player load_data, role_id:', obj.player_data.player_info.role_id, ' role_name:', obj.player_data.player_info.role_name);
	this.gate_cid = gate_cid;
	this.player_cid = player_cid; 
	this.player_info = obj.player_data.player_info;
	this.hero.load_data(this, obj);
	this.bag.load_data(this, obj);
	this.mail.load_data(this, obj);

	this.cplayer = get_game_player_by_gate_cid(gate_cid, player_cid);
	if(this.cplayer == null) {
		print('get game_player null, role_id:', this.player_info.role_id, ' role_name:', this.player_info.role_name);
		game_close_client(gate_cid, player_cid, Error_Code.ERROR_CLIENT_PARAM);
		return;
	}
	if(this.player_info.last_scene == 0)
		this.player_info.last_scene = 11001;
	print("JS READY TO ENTER SCENE");
	this.cplayer.enter_scene(this.player_info.last_scene, this.player_info.last_pos.x, this.player_info.last_pos.y, this.player_info.last_pos.z);
	this.set_aoi_info();

	this.sync_login_to_client();
	this.sync_login_to_master();
	game_player_cid_map.set(this.gate_cid * 10000 + this.player_cid, this);
	game_player_role_id_map.set(this.player_info.role_id, this);
	game_player_role_name_map.set(this.player_info.role_name, this);
}

//玩家离线，保存数据
Game_Player.prototype.save_player_data = function() {
	print('***************game_player save_data,role_id:', this.player_info.role_id, " role_name:", this.player_info.role_name);
	this.player_info.logout_time = util.now_sec();
	this.sync_player_data_to_db(true);
	this.sync_logout_to_log();
	this.cplayer.leave_scene();
	
	logout_map.set(this.player_info.account, this.player_info.logout_time);
	game_player_cid_map.delete(this.gate_cid * 10000 + this.player_cid);
	game_player_role_id_map.delete(this.player_info.role_id);
	game_player_role_name_map.delete(this.player_info.role_name);
}

Game_Player.prototype.sync_player_data_to_db = function(logout) {
	print('***************sync_player_data_to_db, logout:', logout, ' role_id:', this.player_info.role_id, ' role_name:', this.player_info.role_name);
	var msg = new MSG_150003();
	msg.logout = logout;
	msg.account = this.player_info.account;
	msg.player_data.player_info = this.player_info;
	this.hero.save_data(msg);
	this.bag.save_data(msg);
	this.mail.save_data(msg);
	send_game_msg_to_db(Msg.SYNC_GAME_DB_SAVE_PLAYER, msg);

	this.is_change = false;
}

Game_Player.prototype.set_data_change = function() {
	this.is_change = true;
}

Game_Player.prototype.tick = function(now) {
	//同步玩家数据到数据库
	if(this.is_change){
		if (now - this.sync_player_data_tick >= 15) {
			this.sync_player_data_to_db(false);
			this.set_aoi_info()
			this.sync_player_data_tick = now;
		}
	}
}

Game_Player.prototype.set_aoi_info = function() {
	var aoi_info = new Aoi_Info;
	aoi_info.name = this.player_info.account_name;
	aoi_info.name = this.player_info.level;
	this.cplayer.set_aoi_info(aoi_info);
}

Game_Player.prototype.daily_refresh = function() {
	this.player_info.buy_vitality_times = 0;
}

Game_Player.prototype.send_success_msg = function(msg_id, msg) {
	send_game_msg_to_gate(this.gate_cid, this.player_cid, msg_id, 0, msg);
	this.set_data_change();
}

Game_Player.prototype.send_error_msg = function(msg_id, error_code) {
	send_game_msg_to_gate(this.gate_cid, this.player_cid, msg_id, error_code);
}

Game_Player.prototype.sync_login_to_client = function() {
	var msg = new MSG_520001();
	msg.role_info.role_id = this.player_info.role_id;
	msg.role_info.account = this.player_info.account;
	msg.role_info.role_name = this.player_info.role_name;
	msg.role_info.level = this.player_info.level;
	msg.role_info.exp = this.player_info.exp;
	msg.role_info.career = this.player_info.career;
	msg.role_info.gender = this.player_info.gender;
	msg.role_info.vitality = this.player_info.vitality;
	msg.role_info.buy_vitality_times = this.player_info.buy_vitality_times;
	msg.role_info.vip_level = this.player_info.vip_level;
	msg.role_info.vip_exp = this.player_info.vip_exp;
	msg.role_info.charge_gold = this.player_info.charge_gold;
	this.send_success_msg(Msg.RES_FETCH_ROLE_INFO, msg);
}

Game_Player.prototype.sync_login_to_master = function() {
	var msg = new MSG_160000();
	msg.player_info.role_id = this.player_info.role_id;
	msg.player_info.account = this.player_info.account;
	msg.player_info.role_name = this.player_info.role_name;
	msg.player_info.level = this.player_info.level;
	msg.player_info.gender = this.player_info.gender;
	msg.player_info.career = this.player_info.career;
	send_game_msg_to_master(this.player_cid, Msg.SYNC_GAME_MASTER_PLYAER_LOGIN, 0, msg);
}

Game_Player.prototype.sync_logout_to_log = function() {
	var msg = new MSG_170000();
	msg.role_id = this.player_info.role_id;
	msg.role_name = this.player_info.role_name;
	msg.account = this.player_info.account;
	msg.level = this.player_info.level;
	msg.client_ip = this.player_info.client_ip;
	msg.login_time = this.player_info.login_time;
	msg.logout_time = this.player_info.logout_time;
	send_game_msg_to_log(Msg.SYNC_LOG_LOGINOUT, msg);
}

Game_Player.prototype.add_exp = function(exp) {
	print('add_exp, role_id:', this.player_info.role_id, " role_name:", this.player_info.role_name, " exp:", exp);
	
	if (exp <= 0) {
		return this.send_error_msg(Msg.ACTIVE_PLAYER_INFO, Error_Code.ERROR_CLIENT_PARAM);
	}
	
	//经验增加升级
	this.player_info.exp += exp;
	var max_player_level = config.util_json.max_player_level;
	for (var i = this.player_info.level; i < max_player_level; ++i) {
		var level_exp = config.level_json[i].level_exp;
		if (this.player_info.exp < level_exp) 
			break;
		
		this.player_info.level++;
		this.player_info.exp -= level_exp;
	}
	
	var msg = new MSG_300001();
	msg.player_level = this.player_info.level;
	msg.player_exp = this.player_info.exp;
	this.send_success_msg(Msg.ACTIVE_PLAYER_INFO, msg);
}
	
Game_Player.prototype.update_vip = function(charge_id) {
	var charge_exp = config.recharge_json[charge_id].vip_exp;
	this.player_info.vip_exp += charge_exp;
	var max_vip_level = config.util_json.max_vip_level;
	for (var i = this.player_info.vip_level; i < max_vip_level; ++i) {
		var level_exp = config.vip_json[i].level_exp;
		if (this.player_info.vip_exp < level_exp) 
			break;
		
		this.player_info.vip_level++;
		this.player_info.vip_exp -= level_exp;
	}
	
	var msg = new MSG_300002();
	msg.vip_level = this.player_info.vip_level;
	msg.vip_exp = this.player_info.vip_exp;
	this.send_success_msg(Msg.ACTIVE_VIP_INFO, msg);
}
	
Game_Player.prototype.buy_vitality = function() {
	print('buy_vitality, role_id:', this.player_info.role_id, " role_name:", this.player_info.role_name, " util.now_msec:", util.now_msec());

	//1.检查可以购买体力次数
	var max_buy_times = config.vip_json[this.player_info.vip_level].max_buy_vitality;
	if (this.player_info.buy_vitality_times >= max_buy_times){
		return send_game_msg_to_gate(this.gate_cid, this.player_cid, Msg.RES_BUY_VITALITY, Error_Code.ERROR_VITALITY_TIMES_NOT_ENOUGH);
	}

	//2.更新元宝
	var buy_vitality_gold = config.util_json.buy_vitality_gold;
	if (buy_vitality_gold == null || this.player_info.buy_vitality_times >= buy_vitality_gold.length) {
		return send_game_msg_to_gate(this.gate_cid, this.player_cid, Msg.RES_BUY_VITALITY, Error_Code.ERROR_CONFIG_NOT_EXIST);
	}	
	var cost_gold = buy_vitality_gold[this.player_info.buy_vitality_times];
	var result = this.bag.bag_sub_money(0, cost_gold);
	if (result != 0) {
		return send_game_msg_to_gate(this.gate_cid, this.player_cid, Msg.RES_BUY_VITALITY, result);
	}
	
	//3.更新体力(120应该为配置)
	this.player_info.buy_vitality_times++;
	var maxVit = config.level_json[this.player_info.level].max_vitality;
	this.player_info.vitality = Math.min(Math.max(0, (this.player_info.vitality + 120)), maxVit);
	
	var msg = new MSG_520003();
	msg.vitality = this.player_info.vitality;
	this.send_success_msg(Msg.RES_BUY_VITALITY, msg);
}

Game_Player.prototype.set_guild_info = function(obj) {
	this.player_info.guild_id = obj.guild_id;
	this.player_info.guild_name = obj.guild_name;
	this.set_data_change();
	print('set_guild_info, role_id:', this.player_info.role_id, " role_name:", this.player_info.role_name, 
	" guild_id:", this.player_info.guild_id, " guild_name:", this.player_info.guild_name);
}

Game_Player.prototype.sync_data_to_master = function() {
	var msg = new MSG_165000();
	msg.level = this.player_info.level;

	var buf = pop_game_buffer();
	msg.serialize(buf);
	this.cplayer.sync_data_to_master(Msg_GM.SYNC_GAME_MASTER_PLAYER_INFO, buf);
	push_game_buffer(buf);
}

Game_Player.prototype.move_to_point = function(obj) {
	print('move to point, role_id:', this.player_info.role_id, " role_name:", this.player_info.role_name, " util.now_msec:", util.now_msec());
	this.cplayer.move_to_point(obj.pos.x, obj.pos.y, obj.pos.z);
}

Game_Player.prototype.change_scene = function(obj) {
	print('change scene, role_id:', this.player_info.role_id, " role_name:", this.player_info.role_name, " util.now_msec:", util.now_msec());
	if(is_scene_in_process(obj.target_scene)) {
		this.cplayer.leave_scene();
		this.cplayer.enter_scene(obj.target_scene, obj.pos.x, obj.pos.y, obj.pos.z);
		this.cplayer.set_aoi_info();
		var msg = new MSG_520401();
		this.send_success_msg(Msg_GC.RES_CHANGE_SCENE, msg);
	}
	else {
		this.player_info.last_scene = obj.target_scene;
		this.player_info.last_pos = obj.pos;
		
		logout_map.set(this.player_info.account, this.player_info.logout_time);
		game_player_cid_map.delete(this.gate_cid * 10000 + this.player_cid);
		game_player_role_id_map.delete(this.player_info.role_id);
		game_player_role_name_map.delete(this.player_info.role_name);
		
		this.sync_player_data_to_db(false);
		this.cplayer.game_player_link_close();

		var msg = new MSG_160101();
		msg.target_scene = obj.target_scene;
		msg.role_id = this.player_info.role_id;
		send_game_msg_to_master(this.player_cid, Msg_GM.SYNC_PLAYER_CHANGE_SCENE, 0, msg);
	}
}
