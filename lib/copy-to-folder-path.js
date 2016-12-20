'use babel';

import CopyToFolderPathView from './copy-to-folder-path-view';
import OneLineInputView from './OneLineInputView';
import {
	CompositeDisposable
} from 'atom';
import {
	exec
} from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs-plus';


export default {

	copyToFolderPathView: null,
	oneLineInputView: null,
	modalPanel: null,
	inputPanel: null,
	subscriptions: null,

	// パッケージ実行時にここから処理される
	activate(state) {
		console.log(state);
		this.copyToFolderPathView = new CopyToFolderPathView(state.copyToFolderPathViewState);
		this.modalPanel = atom.workspace.addModalPanel({
			item: this.copyToFolderPathView.getElement(),
			visible: false
		});

		this.oneLineInputView = new OneLineInputView(state.oneLineInputViewState);
		this.inputPanel = atom.workspace.addModalPanel({
			item: this.oneLineInputView.getElement(),
			visible: false
		});
		console.log(this.inputPanel);

		// Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
		this.subscriptions = new CompositeDisposable();

		// Register command that toggles this view
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'copy-to-folder-path:CopyToPath': () => this.sendFileCurrentProjectPath(),
			'copy-to-folder-path:ConfigureCopyPath': () => this.CreateConfigFile(),
			'copy-to-folder-path:toggle': () => this.toggle()
		}));

	},

	// ウインドウが閉じられた時に呼び出される
	serialize() {
		return {
			copyToFolderPathViewState: this.copyToFolderPathView.serialize(),
			oneLineInputViewState: this.oneLineInputView.serialize()
		};
	},

	// 本パッケージを無効にする処理 ウインドウを閉じた時に呼び出される
	deactivate() {
		this.modalPanel.destroy();
		this.subscriptions.dispose();
		this.copyToFolderPathView.destroy();
		this.oneLineInputView.destroy();
		this.inputPanel.destroy();
	},

	// 本パッケージの有効無効の切り替え
	toggle() {
		console.log('CopyToFolderPath was toggled!');
		return (
			this.modalPanel.isVisible() ?
			this.modalPanel.hide() :
			this.modalPanel.show()
		);
	},

	// 各プロジェクトにある設定ファイルのパスを読み込む
	getJsonPath() {
		let projectPath = this.getOpenCurrentProjectPath();
		let configPath = path.join(projectPath, atom.config.get('copy-to-folder-path.configFileName'));
		console.log(`Jsonのパス :${configPath}`);
		return configPath;
	},

	// 各プロジェクトにある設定ファイルのJsonの中身を取得
	readConfigJson() {
		let configPath = this.getJsonPath();
		let readjson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		return readjson;
	},

	// 現在開いているファイルのプロジェクトのパスをCMDで開く処理を投げる
	sendFileCurrentProjectPath() {
		// 現在開いているファイルのルートプロジェクトを開く
		var projectPath = this.getOpenCurrentProjectPath();
		if (projectPath !== null) { // projectPathはツリーに追加されていないファイルの場合はNullになる
			if (fs.isFileSync(this.getJsonPath())) {
				// 設定ファイルが存在するならそのまま開く
				return this.open_terminal(projectPath);
			} else {
				// 設定ファイルが存在しないため作成
				this.CreateConfigFile();
			}
		}
		return;
	},

	// ツリーに存在するすべてのプロジェクトをCMDで開く処理を投げる
	sendAllProjectPath() {
		// ツリーに追加されているすべてのプロジェクトを開く
		var i, len, pathname, ref, results;
		ref = atom.project.getPaths();
		ref2 = atom.project.getDirectories();
		console.log(ref);
		console.log(ref2);
		results = [];
		for (i = 0, len = ref.length; i < len; i++) {
			pathname = ref[i];
			results.push(this.open_terminal(pathname));
		}
		return results;
	},

	// 現在開いているファイルのパスをCMDで開く処理を投げる
	sendFilePath() {
		// 現在開いているファイルのパスを開く(ファイルのパスは含めない)
		var editor, file, filepath, ref;
		editor = atom.workspace.getActivePaneItem();
		file = editor !== null ? (ref = editor.buffer) !== null ? ref.file : void 0 : void 0;
		filepath = file !== null ? file.path : void 0;
		if (filepath) {
			console.log(path.dirname());
			return this.open_terminal(path.dirname(filepath));
		}
	},

	// 各プロジェクトごとに設定ファイルを作成する
	CreateConfigFile() {
		console.log("ConfigureCopyPath create");
		var projectPath = this.getOpenCurrentProjectPath(); // 現在開いているプロジェクトのパスを取得
		if (projectPath !== null) { // projectPathはツリーに追加されていないファイルの場合はNullになる
			console.log(projectPath);
			var configPath = this.getJsonPath(); // 設定ファイルのパスを取得
			console.log(configPath);
			if (!fs.isFileSync(configPath)) {
				//configPath のファイルが存在しな時の処理
				this.inputPanelOpen();
			} else {
				var results = atom.confirm({
					message: "すでに設定ファイルは存在しますが上書きしますか?",
					buttons: ["Cancel", "上書き"]
				});
				console.log(`results :${results}`);
				if (results === 1) {
					this.inputPanelOpen();
				}
			}
		}
		return;
	},

	inputPanelOpen(jsonWritePath) {
		console.log("file out put start");
		this.oneLineInputView.showPanel();
		var log = this.oneLineInputView.setCallback(function(text) {
			var editor;
			console.log("入力したパスは" + text);
			editor = atom.workspace.getActiveTextEditor();
			atom.views.getView(editor).focus();
			this.createJson(text);
			return
		});
	},

	// CMDを起動する処理 ここでCMDで開く処理を投げる
	open_terminal(readProjectPath) {
		console.log(readProjectPath);
		var writePath, cmdline;
		app = atom.packages.resolvePackagePath("copy-to-folder-path");
		app += atom.config.get('copy-to-folder-path.app');
		console.log(`実行CMDパス :${app}`);

		var readjson = this.readConfigJson();
		writePath = readjson.CopyToPath; //転送先を読み込む

		cmdline = "\"" + app + "\" " + writePath;
		cmdline = "start \"\" " + cmdline;
		console.log("copy-to-folder-path executing: ", cmdline);
		if (readProjectPath !== null) {
			return exec(cmdline, {
				cwd: readProjectPath
			}, function(error, stdout, stderr) {
				console.log('-------cmd end-------');
				console.log('stdout: ' + stdout);
				console.log('stderr: ' + stderr);
				if (error !== null) {
					console.log('exec error: ' + error);
				}
			});
		}
	},

	// 現在開いているプロジェクトのパスを取得する
	getOpenCurrentProjectPath() {
		var editor, file, filepath, projectPath, ref, ref2, relativePath;
		editor = atom.workspace.getActivePaneItem();
		file = editor !== null ? (ref = editor.buffer) !== null ? ref.file : void 0 : void 0;
		filepath = file !== null ? file.path : void 0;
		if (filepath) {
			ref2 = atom.project.relativizePath(filepath);
			projectPath = ref2[0];
			relativePath = ref2[1];
		} else {
			console.error("error filepath : " + filepath);
		}
		return projectPath;
	},
};