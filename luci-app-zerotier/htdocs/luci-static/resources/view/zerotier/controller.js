/* SPDX-License-Identifier: GPL-3.0-only */

'use strict';
'require fs';
'require ui';
'require uci';
'require view';

return view.extend({
	handleCreateNetwork: function(token) {
		var createUrl = 'http://127.0.0.1:9993/status';
		return fs.exec('/usr/bin/curl', ['-s', '-H', 'X-ZT1-AUTH: ' + token, createUrl])
			.then(function(statusRes) {
				if (statusRes.code !== 0) throw new Error(_('Unable to get status'));
				var status = JSON.parse(statusRes.stdout);
				if (!status.address) throw new Error(_('Node ID not found'));

				var netUrl = 'http://127.0.0.1:9993/controller/network/' + status.address + '______';
				return fs.exec('/usr/bin/curl', [
					'-s', '-X', 'POST', '-H', 'X-ZT1-AUTH: ' + token,
					'-H', 'Content-Type: application/json', '-d', '{}', netUrl
				]);
			}).then(function(res) {
				if (res.code !== 0) throw new Error(res.stderr);
				ui.addNotification(null, E('p', {}, _('Network created successfully.')), 'info');
				setTimeout(function() { window.location.reload(); }, 1500);
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Creation failed: %s').format(err.message)), 'error');
			});
	},

	handleDeleteNetwork: function(netId, token) {
		if (!confirm(_('Are you sure you want to completely delete network %s? This action cannot be undone!').format(netId))) return;
		return fs.exec('/usr/bin/curl', [
			'-s', '-X', 'DELETE', '-H', 'X-ZT1-AUTH: ' + token, 'http://127.0.0.1:9993/controller/network/' + netId
		]).then(function(res) {
			if (res.code !== 0) throw new Error();
			ui.addNotification(null, E('p', {}, _('Network successfully deleted.')), 'info');
			setTimeout(function() { window.location.reload(); }, 1500);
		}).catch(function() {
			ui.addNotification(null, E('p', {}, _('Delete failed.')), 'error');
		});
	},

	handleNetworkSettings: function(netId, token) {
		var netUrl = 'http://127.0.0.1:9993/controller/network/' + netId;
		return fs.exec('/usr/bin/curl', ['-s', '-H', 'X-ZT1-AUTH: ' + token, netUrl])
			.then(function(res) {
				if (res.code !== 0) throw new Error();
				var netData = JSON.parse(res.stdout);
				var isPrivate = (netData.private !== false); 
				var currentTarget = '', currentStart = '', currentEnd = '';
				
				if (netData.routes && netData.routes.length > 0) currentTarget = netData.routes[0].target || '';
				if (netData.ipAssignmentPools && netData.ipAssignmentPools.length > 0) {
					currentStart = netData.ipAssignmentPools[0].ipRangeStart || '';
					currentEnd = netData.ipAssignmentPools[0].ipRangeEnd || '';
				}

				var inputName = E('input', { type: 'text', value: netData.name || '', placeholder: 'e.g. My Home VPN' });
				var privateSelect = E('select', {}, [
					E('option', { value: '1', selected: isPrivate ? 'selected' : null }, _('Private - Requires manual authorization')),
					E('option', { value: '0', selected: !isPrivate ? 'selected' : null }, _('Public - Anyone with the ID can connect'))
				]);
				var inputTarget = E('input', { type: 'text', value: currentTarget, placeholder: 'e.g. 10.144.0.0/16' });
				var inputStart = E('input', { type: 'text', value: currentStart, placeholder: 'e.g. 10.144.0.1' });
				var inputEnd = E('input', { type: 'text', value: currentEnd, placeholder: 'e.g. 10.144.255.254' });

				var form = E('div', {}, [
					E('div', { class: 'cbi-value' }, [ E('label', { class: 'cbi-value-title' }, E('strong', {}, _('Network Name'))), E('div', { class: 'cbi-value-field' }, inputName) ]),
					E('div', { class: 'cbi-value' }, [ E('label', { class: 'cbi-value-title' }, E('strong', {}, _('Access Control'))), E('div', { class: 'cbi-value-field' }, privateSelect) ]),
					E('hr'),
					E('p', {}, _('Set the IPv4 range for this virtual LAN. Leave blank to disable auto-assignment.')),
					E('div', { class: 'cbi-value' }, [ E('label', { class: 'cbi-value-title' }, _('Target Network')), E('div', { class: 'cbi-value-field' }, inputTarget) ]),
					E('div', { class: 'cbi-value' }, [ E('label', { class: 'cbi-value-title' }, _('Assignment Start IP')), E('div', { class: 'cbi-value-field' }, inputStart) ]),
					E('div', { class: 'cbi-value' }, [ E('label', { class: 'cbi-value-title' }, _('Assignment End IP')), E('div', { class: 'cbi-value-field' }, inputEnd) ])
				]);

				ui.showModal(_('Network Settings') + ' - ' + netId, [
					E('style', {}, '.modal { max-width: 800px !important; }'),
					form,
					E('div', { class: 'right', style: 'margin-top: 15px;' }, [
						E('button', { class: 'cbi-button cbi-button-neutral', click: ui.hideModal }, _('Cancel')), ' ',
						E('button', {
							class: 'cbi-button cbi-button-positive',
							click: ui.createHandlerFn(this, function() {
								var payload = {
									name: inputName.value.trim(),
									private: (privateSelect.value === '1'),
									v4AssignMode: { zt: true }, routes: [], ipAssignmentPools: []
								};
								var t = inputTarget.value.trim(), s = inputStart.value.trim(), e = inputEnd.value.trim();
								if (t) payload.routes.push({ target: t });
								if (s && e) payload.ipAssignmentPools.push({ ipRangeStart: s, ipRangeEnd: e });

								return fs.exec('/usr/bin/curl', [
									'-s', '-X', 'POST', '-H', 'X-ZT1-AUTH: ' + token,
									'-H', 'Content-Type: application/json', '-d', JSON.stringify(payload), netUrl
								]).then(function(res) {
									if(res.code !== 0) throw new Error();
									ui.hideModal();
									ui.addNotification(null, E('p', {}, _('Network settings updated successfully.')), 'info');
								}).catch(function() {
									ui.addNotification(null, E('p', {}, _('Failed to update network settings.')), 'error');
								});
							})
						}, _('Save Settings'))
					])
				]);
			}).catch(function() {
				ui.addNotification(null, E('p', {}, _('Unable to fetch network settings.')), 'error');
			});
	},

	handleManageMembers: function(netId, token) {
		var membersUrl = 'http://127.0.0.1:9993/controller/network/' + netId + '/member';
		var peersUrl = 'http://127.0.0.1:9993/peer';

		return uci.load('zerotier').then(function() {
			return Promise.all([
				fs.exec('/usr/bin/curl', ['-s', '-H', 'X-ZT1-AUTH: ' + token, membersUrl]),
				fs.exec('/usr/bin/curl', ['-s', '-H', 'X-ZT1-AUTH: ' + token, peersUrl])
			]);
		}).then(function(results) {
			if (results[0].code !== 0) throw new Error();
			var members = {}, peers = [], peerMap = {};
			try { members = JSON.parse(results[0].stdout); } catch(e) {}
			try { peers = JSON.parse(results[1].stdout); } catch(e) {}
			peers.forEach(function(p) { peerMap[p.address] = p; });

			var memberIds = Object.keys(members);
			if (memberIds.length === 0) return { details: [], peerMap: peerMap };

			var detailPromises = memberIds.map(function(mId) {
				return fs.exec('/usr/bin/curl', ['-s', '-H', 'X-ZT1-AUTH: ' + token, membersUrl + '/' + mId])
					.then(function(dRes) {
						var mData = { authorized: false, ipAssignments: [] };
						if (dRes.code === 0) try { mData = Object.assign(mData, JSON.parse(dRes.stdout)); } catch(e) {}
						mData._id = mId; return mData;
					});
			});
			return Promise.all(detailPromises).then(function(details) { return { details: details, peerMap: peerMap }; });
		}).then(function(data) {
			var mRows = [
				E('tr', {class: 'tr table-titles'}, [
					E('th', {class: 'th left'}, _('Node ID')),
					E('th', {class: 'th left'}, _('Name')),
					E('th', {class: 'th center'}, _('Auth')),
					E('th', {class: 'th left'}, _('Assigned IPs')),
					E('th', {class: 'th left'}, _('Physical IP')),
					E('th', {class: 'th left'}, _('Last Seen'))
				])
			];

			if (data.details.length === 0) {
				mRows.push(E('tr', {class: 'tr'}, [ E('td', {class: 'td center', colspan: '6'}, E('em', {}, _('No devices found.'))) ]));
			} else {
				data.details.forEach(function(mData) {
					var mId = mData._id;
					var physicalIp = E('em', { style: 'color: #999;' }, _('Offline'));
					var lastSeen = E('em', { style: 'color: #999;' }, _('Unknown'));
					var pInfo = data.peerMap[mId];

					if (pInfo && pInfo.paths) {
						var preferredPath = pInfo.paths.find(function(p) { return p.preferred; });
						if (preferredPath) {
							physicalIp = E('span', { style: 'color: #5cb85c; font-family: monospace;' }, preferredPath.address.split('/')[0]);
							var diffMs = Date.now() - preferredPath.lastReceive;
							if (diffMs < 60000) lastSeen = _('Just now');
							else if (diffMs < 3600000) lastSeen = Math.floor(diffMs / 60000) + _(' mins ago');
							else lastSeen = Math.floor(diffMs / 3600000) + _(' hours ago');
						}
					}

					var nameInput = E('input', { type: 'text', value: uci.get('zerotier', mId, 'name') || '', placeholder: _('Remarks'), style: 'width: 100px;' });
					var saveNameBtn = E('button', {
						class: 'cbi-button cbi-button-save', style: 'margin-left: 5px;',
						click: ui.createHandlerFn(this, function() {
							var newName = nameInput.value.trim();
							if (!uci.get('zerotier', mId)) uci.add('zerotier', 'member', mId);
							if (newName) uci.set('zerotier', mId, 'name', newName); else uci.unset('zerotier', mId, 'name'); 
							return uci.save().then(function() { return uci.apply(); }).then(function() {
								ui.addNotification(null, E('p', {}, _('Name saved successfully.')), 'info');
							});
						})
					}, _('Save'));

					var authCheckbox = E('input', {
						type: 'checkbox', checked: mData.authorized ? 'checked' : null,
						click: ui.createHandlerFn(this, function(cev) {
							var newAuth = cev.target.checked;
							return fs.exec('/usr/bin/curl', [
								'-s', '-X', 'POST', '-H', 'X-ZT1-AUTH: ' + token,
								'-H', 'Content-Type: application/json', '-d', JSON.stringify({ authorized: newAuth }), membersUrl + '/' + mId
							]).then(function(res) {
								if(res.code !== 0) throw new Error();
								ui.addNotification(null, E('p', {}, _('Authorization updated.')), 'info');
							}).catch(function() { cev.target.checked = !newAuth; });
						})
					});

					var ipInput = E('input', { type: 'text', value: (mData.ipAssignments || []).join(', '), placeholder: _('Leave blank for auto'), style: 'width: 140px;' });
					var saveIpBtn = E('button', {
						class: 'cbi-button cbi-button-save', style: 'margin-left: 5px;',
						click: ui.createHandlerFn(this, function() {
							var val = ipInput.value.trim();
							var ipArr = val !== '' ? val.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; }) : [];
							return fs.exec('/usr/bin/curl', [
								'-s', '-X', 'POST', '-H', 'X-ZT1-AUTH: ' + token,
								'-H', 'Content-Type: application/json', '-d', JSON.stringify({ ipAssignments: ipArr }), membersUrl + '/' + mId
							]).then(function(res) {
								if(res.code !== 0) throw new Error();
								ui.addNotification(null, E('p', {}, _('IP assignments saved.')), 'info');
							});
						})
					}, _('Apply'));

					var deleteMemberBtn = E('button', {
						class: 'cbi-button cbi-button-remove', style: 'margin-left: 5px;',
						click: ui.createHandlerFn(this, function() {
							if (!confirm(_('Are you sure you want to delete device %s from this network?').format(mId))) return;
							return fs.exec('/usr/bin/curl', ['-s', '-X', 'DELETE', '-H', 'X-ZT1-AUTH: ' + token, membersUrl + '/' + mId])
								.then(function(res) {
									if(res.code !== 0) throw new Error();
									if (uci.get('zerotier', mId)) { uci.remove('zerotier', mId); return uci.save().then(function() { return uci.apply(); }); }
								}).then(function() {
									ui.addNotification(null, E('p', {}, _('Device deleted successfully.')), 'info');
									setTimeout(function() { window.location.reload(); }, 1500);
								}).catch(function() { ui.addNotification(null, E('p', {}, _('Failed to delete device.')), 'error'); });
						})
					}, _('Delete'));

					mRows.push(E('tr', {class: 'tr'}, [
						E('td', {class: 'td left', style: 'white-space: nowrap; font-family: monospace;'}, E('strong', {}, mId)),
						E('td', {class: 'td left', style: 'white-space: nowrap;'}, E('div', { style: 'display: flex; gap: 5px;' }, [nameInput, saveNameBtn])),
						E('td', {class: 'td center'}, authCheckbox),
						E('td', {class: 'td left', style: 'white-space: nowrap;'}, E('div', { style: 'display: flex; gap: 5px;' }, [ipInput, saveIpBtn, deleteMemberBtn])),
						E('td', {class: 'td left', style: 'white-space: nowrap;'}, physicalIp),
						E('td', {class: 'td left', style: 'white-space: nowrap;'}, lastSeen)
					]));
				});
			}

			var manualNodeInput = E('input', { type: 'text', placeholder: _('Enter 10-digit Node ID'), maxlength: 10, style: 'width: 150px; text-transform: lowercase;' });
			var manualAddBtn = E('button', {
				class: 'cbi-button cbi-button-add', style: 'margin-left: 10px;',
				click: ui.createHandlerFn(this, function() {
					var newNode = manualNodeInput.value.trim().toLowerCase();
					if (!/^[0-9a-f]{10}$/.test(newNode)) { alert(_('Node ID must be 10 alphanumeric characters.')); return; }
					return fs.exec('/usr/bin/curl', [
						'-s', '-X', 'POST', '-H', 'X-ZT1-AUTH: ' + token,
						'-H', 'Content-Type: application/json', '-d', JSON.stringify({ authorized: true }), membersUrl + '/' + newNode
					]).then(function(res) {
						if (res.code !== 0) throw new Error();
						ui.addNotification(null, E('p', {}, _('Device manually added and authorized.')), 'info');
						setTimeout(function() { window.location.reload(); }, 1000);
					}).catch(function() { ui.addNotification(null, E('p', {}, _('Manual addition failed.')), 'error'); });
				})
			}, _('Add Member'));

			var manualAddContainer = E('div', { class: 'alert-message notice', style: 'margin-top: 15px; display: flex; align-items: center; flex-wrap: wrap;' }, [
				E('strong', { style: 'margin-right: 10px;' }, _('Manually Add Member: ')),
				manualNodeInput, manualAddBtn,
				E('div', {style: 'flex-basis: 100%; margin-top: 5px; font-size: 0.9em; opacity: 0.8;'}, _('You can pre-authorize the Node ID of an unconnected device.'))
			]);

			ui.showModal(_('Manage Network Members') + ' - ' + netId, [
				E('style', {}, '.modal { max-width: 1100px !important; width: 95% !important; }'),
				E('div', { style: 'width: 100%; overflow-x: auto;' }, [ E('table', { 'class': 'table cbi-section-table' }, mRows) ]),
				manualAddContainer,
				E('div', { class: 'right', style: 'margin-top: 15px;' }, [ E('button', { class: 'cbi-button cbi-button-neutral', click: ui.hideModal }, _('Close')) ])
			]);
		}).catch(function() { ui.addNotification(null, E('p', {}, _('Unable to fetch members list.')), 'error'); });
	},

	load: function() {
		return fs.read_direct('/var/lib/zerotier-one/authtoken.secret').then(function(token) {
			if (!token || token.trim() === '') throw new Error(_('Unable to read API Token, please check if ZeroTier service is running.'));
			var cleanToken = token.trim();
			return fs.exec('/usr/bin/curl', ['-s', '-H', 'X-ZT1-AUTH: ' + cleanToken, 'http://127.0.0.1:9993/controller/network'])
				.then(function(res) {
					if (res.code !== 0 || !res.stdout) throw new Error(_('API call failed: %s').format(res.stderr));
					return { token: cleanToken, networks: JSON.parse(res.stdout) };
				});
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, err.message), 'error');
			return { token: '', networks: [] };
		});
	},

	render: function(data) {
		var token = data.token;
		var networks = data.networks;

		var title = E('h2', {class: 'content'}, _('ZeroTier Controller'));
		var desc = E('div', {class: 'cbi-map-descr'}, _('Manage the ZeroTier virtual network controller on the local router.'));

		var rows = [
			E('tr', {class: 'tr table-titles'}, [
				E('th', {class: 'th left', width: '60%'}, _('Network ID')),
				E('th', {class: 'th right', width: '40%'}, _('Actions'))
			])
		];

		if (!Array.isArray(networks) || networks.length === 0) {
			rows.push(E('tr', {class: 'tr'}, [ E('td', {class: 'td center', colspan: '2'}, E('em', {}, _('No networks have been created yet.'))) ]));
		} else {
			var self = this;
			networks.forEach(function(netId) {
				rows.push(E('tr', {class: 'tr'}, [
					E('td', {class: 'td left'}, E('strong', {}, netId)),
					E('td', {class: 'td right'}, [
						E('button', { class: 'cbi-button cbi-button-action', click: ui.createHandlerFn(self, function() { return self.handleNetworkSettings(netId, token); }) }, _('Network Settings')), ' ',
						E('button', { class: 'cbi-button cbi-button-edit', click: ui.createHandlerFn(self, function() { return self.handleManageMembers(netId, token); }) }, _('Manage Members')), ' ',
						E('button', { class: 'cbi-button cbi-button-remove', click: ui.createHandlerFn(self, function() { return self.handleDeleteNetwork(netId, token); }) }, _('Delete'))
					])
				]));
			});
		}

		var createBtn = E('button', { class: 'cbi-button cbi-button-add', click: ui.createHandlerFn(this, function() { return this.handleCreateNetwork(token); }) }, _('Create New Network'));

		return E('div', {}, [ title, desc, E('table', { 'class': 'table cbi-section-table' }, rows), E('br'), createBtn ]);
	},

	handleSaveApply: null, handleSave: null, handleReset: null
});