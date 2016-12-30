"use strict";

var COMBINER =
	"simple";
//	"yui";
var pack = require('./package.json');
var VERSION = pack.version;

function runTortilla() {

	// detect which version we're running
//	var os = "unknown";
//	if (__dirname.endsWith("linux")) os = "linux";
//	else if (__dirname.endsWith("windows")) os = "windows";
//	else if (__dirname.endsWith("osx")) os = "osx";
//	var posix = (os == "linux" || os == "osx");

	// --- dependencies
	var fs = require("fs.extra");
	var path = require("path");
	var minimist = require("minimist");
	var walk = require('walk');
	var crypto = require('crypto');
	var archiver = require('archiver');
	// not all platforms require the following:
	function execSync() {
		return require('exec-sync');
	}
	function plist() {
		return require('plist');
	}

	var tortillaBase = path.normalize(__dirname);
	//console.log("tortillaBase", tortillaBase);

	var tortArgs = minimist(process.argv.slice(2));
	//console.log("args", tortArgs);

	var plainArgs = tortArgs["_"];

	if (plainArgs.length == 0) {
		console.log("Tortilla " + VERSION);
		console.log("Use the force, read the source!");
		process.exit();
	}
	
	var buildParams = {};
	for (var k in tortArgs) {
		if (k.substring(0,1) == "P") {
			var p = k.substring(1);
			buildParams[p] = tortArgs[k];
		}
	}

	var projectBase = objProp(tortArgs, "project", ".");
	projectBase = path.resolve(process.cwd(), projectBase);
	//console.log("projectBase", projectBase);

	var cmds = {
		build: function(platform) {

			var buildTime = Date.now();

			var platformIsBrowserLike = platform == "browser" || platform == "crosswalk" || platform == "nw";

			var info = {};
			if (fs.existsSync(projectBase + "/info.json"))
				info = JSON.parse(fs.readFileSync(projectBase + "/info.json", "utf8"));

	//		console.log("platform", platform);
			var platformDir = tortillaBase + "/platforms/" + platform;
			var platformPackDir = platformDir + "/pack";

			// determine and create output dir
			var buildDir = objProp(tortArgs, "out", projectBase + "/build");
			var outputDir = buildDir + "/" + platform;
			fs.rmrfSync(outputDir);
			fs.mkdirRecursiveSync(outputDir);

			var tmpContainer = buildDir + "/tmp";
			var tmpRoot = tmpContainer + "/" + Date.now();
			fs.mkdirRecursiveSync(tmpRoot);

			var packOutDir = null;
			if (platform == "crosswalk" || platform == "nw" || platform == "ejecta") {
				packOutDir = tmpRoot + "/pack";
				fs.mkdirRecursiveSync(packOutDir);
			} else {
				packOutDir = outputDir;
			}

			var tmpDirGame = tmpRoot + "/game";
			var tmpDirTort = tmpRoot + "/tortilla";
			fs.mkdirRecursiveSync(tmpDirGame);

			var fontDir = tmpDirGame + "/fonts";

			var manifest = {};
			var fonts = [];
			var afterCopy = [];

			// --- combine the different subdirs of "res" in the game

			var resDir = projectBase + "/res";

			// determine which subdirs to include
			var resDirs = fs.readdirSync(resDir);
			var includedResDirs = [];
			resDirs.forEach(function(f) {
				var include;
				if (f == "always") include = true;
				else {
					var parts = f.split(/\-/);
					var type = parts[0];
					if (type == "platform") {
						var val = parts[1];
						include = val == platform;
					} else if(type == "param") {
						var name = parts[1];
						var val = parts[2];
						include = val == buildParams[name];
					} else {
						include = false;
					}
				}

				if (include) {
					includedResDirs.push(f);
				}

			});

			// combine their contents
			function copyResDir() {
				// if no more subdirs to copy, continue
				if (includedResDirs.length == 0) {
					afterCopyResDirs();
					return;
				}
				// else copy the next subdir
				var rs = resDir + "/" + includedResDirs.shift();
				fs.copyRecursive(rs, tmpDirGame, function(err) {
					if (err) throw err;
					copyResDir();
				});
			}
			copyResDir();
			
			function afterCopyResDirs() {
				// copy the platform files so they may be modified
				// also include the shared files
				fs.copyRecursive(tortillaBase + "/shared", tmpDirTort, function(err) {
					if (err) throw err;
					fs.copyRecursive(platformPackDir, tmpDirTort, function(err) {
						if (err) throw err;
						afterCopyTortDir();
					});
				});

				function afterCopyTortDir() {

					/**
					 * Copy the "plain" files from tortilla and the game to the output dir.
					 */
					function copyFiles() {

						// specify source dirs
						var fDirs = [
							["tortilla", tmpDirTort + "/files"],
							["game", tmpDirGame + "/files"]
						];

						function processFDir() {

							// if no more dirs to process, continue
							if (fDirs.length == 0) {
								afterFiles();
								return;
							}

							// else process the next dir
							var fDir = fDirs.shift();
							var fDirName = fDir[0], fDirPath = fDir[1];
							if (fs.existsSync(fDirPath)) {

								console.log("Copying non-script files (" + fDirName + ")");

								walk.walkSync(fDirPath, {
									listeners: {
										file: function(root,stat,next) {

											var fileDir = path.relative(fDirPath,root);
											var filePath = path.join(fileDir, stat.name).replace(/\\/g, "/");

											// read the file
											var data = fs.readFileSync(path.join(root, stat.name));

											// hash it for the manifest
											var hasher = crypto.createHash('sha256');
											hasher.update(data);
											var hash = hasher.digest("hex");
											manifest[filePath] = {"hash":hash};

											// copy it to the output
											var outDir = path.join(packOutDir, fileDir);
											var fDest = path.join(outDir, stat.name);
											if (fs.existsSync(fDest))
												console.log("- Note: Duplicate file " + filePath);
//												throw new Error("Duplicate file " + filePath);
											fs.mkdirRecursiveSync(outDir);
											fs.writeFileSync(fDest, data);

											next();
										}
									}
								});

							}
							processFDir();

						}
						processFDir();

					}
					copyFiles();

					function afterFiles() {

						if (platformIsBrowserLike && fs.existsSync(fontDir)) {

							var cssText = "";
							var fontOutDir = packOutDir + "/fonts";
							fs.mkdirRecursiveSync(fontOutDir);

							scanFonts(function(name, dir) {
								copySync(dir + "/font.woff", fontOutDir + "/" + name + ".woff");
								cssText +=
									"@font-face {\n" +
									"  font-family: '" + name + "';\n" +
									"  src: url('fonts/" + name + ".woff');\n" +
									"}\n\n";
							});

							fs.writeFileSync(packOutDir + "/fonts.css", cssText, "utf8");

						}

						exportBuildData();
						handleScripts();
					}

					function scanFonts(cb) {
						fonts = fs.readdirSync(fontDir);
						fonts.forEach(function(font) {
							cb(font, fontDir + "/" + font);
						});
					}

					function exportBuildData() {
						// make some build info available to the code
						var tData =
							"tortilla.VERSION = \"" + VERSION + "\";\n" +
							"tortilla.PLATFORM = \"" + platform + "\";\n" +
							"tortilla.platform = tortilla.PLATFORM; // TODO remove\n" +
							"tortilla.MANIFEST = " + JSON.stringify(manifest) + ";\n" +
							"tortilla.BUILD_TIME = " + buildTime + ";\n" +
							"tortilla.BUILD_PARAMETERS = " + JSON.stringify(buildParams) + ";\n";
						if (platformIsBrowserLike) {
							tData += "tortilla.FONTS = " + JSON.stringify(fonts) + ";\n";
						}
						fs.writeFileSync(tmpDirTort + "/src/_z_autodata.js", tData, "utf8");
					}

					function handleScripts() {

						// find all js files
						var jsFiles = [];
						function scanDir(dir, name) {
							var psFiles = [];
							walk.walkSync(dir, {
								listeners: {
									file: function(root,stat,next) {
										if (stat.name.substr(0,5) != "skip.") {
											var a = [path.join(root, stat.name), name, dir, path.relative(dir,root), stat.name];
											psFiles.push(a);
										}
										next();
									}
								}
							});
							psFiles.sort(function(a,b) {
								return a[0].localeCompare(b[0]);
							});
							return psFiles;
						}
						pushAll(jsFiles, scanDir(tmpDirTort + "/src", "tortilla"));
						pushAll(jsFiles, scanDir(tmpDirGame + "/src", "game"));


						var minify = tortArgs.hasOwnProperty("minify");
						var concatjs = tortArgs.hasOwnProperty("concatjs");
						var consolecompat = tortArgs.hasOwnProperty("consolecompat");
						
						var uglify = minify ? require("uglify-js") : null;

						var concatted = "";

						function minifyScript(txt, filename) {
							var ast = uglify.parse(txt, {
								filename: filename
							});

							// compressor needs figure_out_scope too
							ast.figure_out_scope();
							var compressor = uglify.Compressor();
							ast = ast.transform(compressor);

							// need to figure out scope again so mangler works optimally
							ast.figure_out_scope();
							ast.compute_char_frequency();
							ast.mangle_names();

							// get Ugly code back
							return ast.print_to_string();
						}

						function hashScript(txt) {
							var hasher = crypto.createHash('sha256');
							hasher.update(txt, "utf8");
							return truncate(hasher.digest("hex"), 20);
						}

						/**
						 * Copy a number of (Javascript) files to the output dir.
						 * @returns An array of the relative paths of the files, optionally with hash, to be used for inclusion.
						 */
						var copy = function(files, dest, type) {
							var ret = [];
							files.forEach(function(f) {

								// read the file
								var txt = fs.readFileSync(f[0], "utf8");

								// determine its relative location
								var relDir = type + "/" + f[1] + (f[3] == "" ? "" : ("/" + f[3]));
								var relPath = (relDir + "/" + f[4]).replace(/\\/g, "/");

								// if it's a js file (not e.g. a source map):
								if (relPath.lastIndexOf(".js") === relPath.length - 3) {

									if (concatjs) {
										concatted += txt + "\n";
									} else {

										// minify
										if (minify) {
											txt = minifyScript(txt, relPath);
										}

										// if the platform requires it, calculate and return a hash of the file
										if (platform == "browser") {
											var hash = hashScript(txt);
											relPath = relPath.replace(/\.js$/, "_" + hash + ".js");
										}

										// add it to the inclusion list
										ret.push(relPath);

									}

								}

								// write the file to the output dir
								if (!concatjs) {
									var destPath = dest + "/" + relPath;
									fs.mkdirRecursiveSync(dest + "/" + relDir);
									fs.writeFileSync(destPath, txt, "utf8");
								}

							});
							return ret;
						};

						console.log("Copying scripts");
						var jsPaths = copy(jsFiles, packOutDir, "script");
						console.log("Scripts copied");

						if (concatjs) {

							var relPath = "script.js";

							var min = minify ? minifyScript(concatted, relPath) : concatted;

							var hash = hashScript(min);
							relPath = relPath.replace(/\.js$/, "_" + hash + ".js");

							jsPaths.push(relPath);
							fs.writeFileSync(packOutDir + "/" + relPath, min, "utf8");
						}

						// we have a list of javascript files, have it inserted into the bootstrap file later
						afterCopy.push(function() {

							if (platform == "ejecta") {
								processFile(packOutDir + "/index.js", function(html) {
									var scriptTags = "";
									jsPaths.forEach(function(f) {
										scriptTags += "ejecta.include('" + f + "');\n";
									});
									return mustReplace(html, "// SCRIPT //", scriptTags);
								});
							} else if(platform == "browser") {
								processFile(packOutDir + "/index.html", function(html) {
									var scriptTags = "";
									
									if(consolecompat) {
										scriptTags += '<!-- Avoid console errors in browsers that lack a console -->\n' +
											'<script type="text/javascript">\n' +
												'var ua = navigator.userAgent;\n' +
												'var isIE = ua.indexOf("MSIE ") != -1 || ua.indexOf("Trident/") != -1;\n' +
												'var isIEorEDGE = isIE || ua.indexOf("Edge/") != -1;\n\n' +
											
												'if(isIEorEDGE) {\n' +
													'(function() {\n' +
														'var method;\n' +
														'var noop = function () {};\n' +
														'var methods = [\n'+
															"'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',\n" +
															"'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',\n" +
															"'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',\n" +
															"'timeStamp', 'trace', 'warn'\n" +
														'];\n' +
														'var length = methods.length;\n' +
														'var console = (window.console = window.console || {});\n' +
														'while (length--) {\n' +
															'method = methods[length];\n' +
															'console[method] = noop;\n' +
														'}\n' +
													'}());\n' +
												'}\n' +
											'</script>\n\n';
									}
									
									jsPaths.forEach(function(f) {
										scriptTags += "<script src='" + f + "'></script>\n\t\t";
									});
									return mustReplace(html, /<!--SCRIPT-->.+<!--_SCRIPT-->/, scriptTags);
								});
							} else {
								processFile(packOutDir + "/index.html", function(html) {
									var scriptTags = "";
									jsPaths.forEach(function(f) {
										scriptTags += "<script src='" + f + "'></script>\n\t\t";
									});
									return mustReplace(html, /<!--SCRIPT-->.+<!--_SCRIPT-->/, scriptTags);
								});
							}


						});

						afterHandleScripts();

					}

					function afterHandleScripts() {

						afterCopy.forEach(function(func) {
							func();
						});

						// insert the build time in the bootstrap file (for e.g. css references)
						if (platformIsBrowserLike) {
							processFile(packOutDir + "/index.html", function(txt) {
								return mustReplace(txt, /\{BUILD_TIME\}/g, buildTime);
							});
						}

						if (platform == "crosswalk") (function() {

							var projDirTmp = tmpRoot + "/projectHere";
							var projDir = tmpRoot + "/project";

							function pyPath(p) {
								return path.normalize(p).replace(/\\/g, "\\\\");
							}


							// --- make a copy of crosswalk because crosswalk will pollute its own directory with pyc files
							// make a dir and change into it
							var cwDir = tmpRoot + "/cw";
							fs.mkdirRecursiveSync(cwDir);
							var preDir = process.cwd();
							process.chdir(cwDir);

							seq([

								// do the actual copy
								function(done) {
									fs.copyRecursive(platformDir + "/crosswalk", ".", done);
								},
								function(done) {

									// extensions
									var exDir = tmpDirGame + "/extensions";
									var extensions = [];
									if (fs.existsSync(exDir)) {

										console.log("Handling extensions");

										var exTmp = tmpRoot + "/cwex";
										fs.mkdirSync(exTmp);

										fs.readdirSync(exDir).forEach(function(ex) {

											console.log("- Extension: " + ex);

											var ed = exDir + "/" + ex;
											var exName = "xw_" + ex;
											var exOut = exTmp + "/" + exName;
											fs.mkdirSync(exOut);

											// read, augment and write info
											var info = JSON.parse(fs.readFileSync(ed + "/info.json", "utf8"));
											info["name"] = exName;
											info["jsapi"] = exName + ".js";
		//									console.log("Info: " + JSON.stringify(info));
											fs.writeFileSync(exOut + "/" + exName + ".json", JSON.stringify(info), "utf8");

											// copy js and jar
											copySync(ed + "/script.js", exOut + "/" + exName + ".js");
											copySync(ed + "/code.jar", exOut + "/" + exName + ".jar");

											extensions.push(exOut);

										});
									}

									// mod the script
									processFile(cwDir + "/make_apk.py", function(txt) {
										// flush after a print so we can see
										var target = "print(output.decode(\"utf-8\").strip())";
										// return mustReplace(txt, target, target + "\n      sys.stdout.flush()");
										return txt;
									});

									// let crosswalk create the project dir
									var cmdArgs = [
									    "make_apk.py",
									    "--verbose",
										"--package", info.id,
										"--manifest", packOutDir + "/manifest.json",
										// "--target-dir", outputDir,
										"--project-dir", projDirTmp,
										"--project-only", "True"
									];
									// extra args
									for (var a in tortArgs) {
										if (a.substring(0,2) != "xw") continue;
										var arg = a.substring(2);
										cmdArgs.push("--" + arg);
										cmdArgs.push(tortArgs[a]);
									}
									if (extensions.length != 0) {
										cmdArgs.push("--extensions");
										cmdArgs.push(extensions.map(path.normalize).join(path.delimiter));
									}
									console.log("Crosswalk command: " + JSON.stringify(cmdArgs));
									console.log("Making APK...");

									var aSdk = objProp(tortArgs, "android-sdk", "/home/bart/software/android-sdk");
									console.log("PathExt", process.env.PATHEXT);
									runAsync("python", cmdArgs, function (code) {
											if (code != 0) done("make_apk returned error code " + code);
											else {
												process.chdir(preDir);
												done();
											}
										}, {
											PATHEXT: process.env.PATHEXT,
											PATH:
												process.env.PATH
												+ path.delimiter + path.normalize(aSdk + "/tools")
												+ path.delimiter + path.normalize(aSdk + "/platform-tools")
										}
									);

								},
								function(done) {
									fs.rename(projDirTmp + "/" + fs.readdirSync(projDirTmp)[0], projDir, done);
								},
								function(done) {

									// copy resources
									var resDir = tmpDirGame + "/res";
									if (!fs.existsSync(resDir)) done();
									else {
										console.log("Copying resources");
										copyRecursive(resDir, projDir + "/res", done);
									}

								},
								function(done) {

									// copy java source code
									var javaDir = tmpDirGame + "/java";
									if (!fs.existsSync(javaDir)) done();
									else {
										console.log("Including Java code");
										copyRecursive(javaDir, projDir + "/src", done);
										// // modify the crosswalk script to include extra java source
										// processFile(cwDir + "/make_apk.py", function(txt) {
										// 	// line 370
										// 	var target = "cmd = ['python', os.path.join('scripts', 'gyp', 'javac.py'),";
										// 	var pyCode = "src_dirs += ' " + pyPath(javaDir) + "'\n  ";
										// 	return mustReplace(txt, target, pyCode+target);
										// });
									}

								},
								function(done) {

									// add libs
									var libsDir = tmpDirGame + "/libs";
									if (!fs.existsSync(libsDir)) done();
									else {

										console.log("Handling libs");

										// read all libs
										var libNum = 0;
										eachAsync(fs.readdirSync(libsDir), function(lib, nextLib) {
											console.log("- Library: " + lib);

											var libPath = libsDir + "/" + lib;
											if (fs.statSync(libPath).isDirectory()) { // a library project

												copyRecursive(libPath, projDir + "/libproj_" + lib, nextLib);

												processFile(projDir + "/project.properties", function(txt) {
													return txt + "\n" +
														"android.library.reference." + (3+(libNum++)) + "=libproj_" + lib;
												});

												// // add lib projects jars to list of jars
												// var libLibs = libPath + "/libs";
												// if (fs.existsSync(libLibs)) fs.readdirSync(libLibs).forEach(function(liblib) {
												// 	libFiles.push(libLibs + "/" + liblib);
												// });

												// var libManifest = libPath + "/AndroidManifest.xml";
												// libManifestPaths.push(libManifest);

												// // get package name
												// var libPackage = null;
												// var xml2js = require("xml2js");
												// var parser = new xml2js.Parser({async:false});
												// parser.parseString(fs.readFileSync(libManifest, "utf8"), function(err, data) {
												// 	libPackage = data.manifest.$.package;
												// });
												// addResPackages.push(libPackage);

												// // --- handle resources

												// var resDir = libPath + "/res";
												// addResDirs.push(resDir);

												// // generate R
												// // TODO dynamically determine Android SDK location from path?
												// var aSdk = objProp(tortArgs, "android-sdk", "/home/bart/software/android-sdk");
												// var rDir = rDirs + "/" + lib;
												// fs.mkdirpSync(rDir);
												// var cmd = aSdk + "/build-tools/22.0.1/aapt"; // TODO use whatever version make_apk uses
												// var args = [
												// 	"package",
												// 	"-S", resDir,
												// 	"-M", libManifest,
												// 	"-I", aSdk + "/platforms/android-22/android.jar", // TODO use whatever version make_apk uses
												// 	"-J", rDir,
												// 	"--output-text-symbols", rDir
												// ];
												// runAsync(cmd, args, function(code) {
												// 	if (code != 0) throw "aapt returned code " + code;
												// 	addRFiles.push(rDir + "/R.txt");
												// 	nextLib();
												// });

											} else {
												if (lib.endsWith(".jar")) { // a simple jar
													copySync(libPath, projDir + "/libs/" + lib);
												} else {
													console.warn("Don't know how to handle lib " + lib);
												}
												nextLib();
											}

										}, done);

									}

								},
								function(done) {

									// modify AndroidManifest.xml
									var aManifest = projDir + "/AndroidManifest.xml";
									var amApp = tmpDirGame + "/AndroidManifest-application.xml";
									var exAmApp = fs.existsSync(amApp);
									var amMan = tmpDirGame + "/AndroidManifest-manifest.xml";
									var exAmMan = fs.existsSync(amMan);
									if (!(exAmApp || exAmMan)) {
										done();
									} else {

										console.log("Appending AndroidManifest.xml");

										// TODO don't use python but go full nodejs

										// --- start a python interpreter
										var python = runAsync("python", [], function(code) {
											if (code != 0) done("python returned error code " + code);
											else done();
										});

										// --- tell it to make the required modifications
										var i = python.stdin;


										// open the original manifest
										i.write(
											"import sys\n"+
											"from xml.etree import ElementTree\n"+
											"m = ElementTree.parse('" + pyPath(aManifest) + "')\n"+
											"apptag = m.getroot().find('application')\n"
										);

										// extend the <manifest> element
										if (exAmMan) i.write(
											"e = ElementTree.parse('" + pyPath(amMan) + "').getroot()\n"+
											"m.getroot().extend(e)\n"
										);
										// extend the <application> element
										if (exAmApp) i.write(
											"e = ElementTree.parse('" + pyPath(amApp) + "').getroot()\n"+
											"apptag.extend(e)\n"+
											"for key, val in e.items():\n"+
											"  apptag.set(key, val)\n"
										);

										// fix display name
										i.write(
											"apptag.set('{http://schemas.android.com/apk/res/android}label', '" + info.displayName + "')\n"+
											"apptag.find('activity').set('{http://schemas.android.com/apk/res/android}label', '" + info.displayName + "')\n" // <activity />
										);

										// write back the changed manifest
										i.write(
											"ElementTree.register_namespace('android', 'http://schemas.android.com/apk/res/android')\n"+
		//									"print ElementTree.tostring(m.getroot())\n"+
											"m.write('" + pyPath(aManifest) + "', 'UTF-8', True)\n"
										);

										// --- done modifying
										i.end();

									}

								},
								function(done) {
									var preDir = process.cwd();
									process.chdir(projDir);

									var antArgs = [
										"release",
										"-Dkey.store=" + cwDir + "/xwalk-debug.keystore",
										"-Dkey.alias=xwalkdebugkey",
										"-Dkey.store.password=xwalkdebug",
										"-Dkey.alias.password=xwalkdebug"
									];

									runAsync("ant", antArgs, function(code) {
										if (code != 0) done("ant returned error code " + code);
										else {
											process.chdir(preDir);
											// copySync("", outputDir + "/build.apk"); TODO
											done();
										}
									});
								}

							], finish);

						})();
						else if (platform == "nw") {

							var nwZip = outputDir + "/game.nw";

							var output = fs.createWriteStream(nwZip);
							var archive = archiver("zip");

							output.on("close", function () {

								// --- linux64
								var od = outputDir + "/linux64";
								fs.mkdirRecursiveSync(od);
								var exe = od + "/game";
								var nd = platformDir + "/nw/linux64";

								var nwBuf = fs.readFileSync(nd + "/nw");
								var gameBuf = fs.readFileSync(nwZip);
								var concat = Buffer.concat([nwBuf, gameBuf]);
								fs.writeFileSync(exe, concat);

								fs.chmodSync(exe, "755");

								copySync(nd + "/nw.pak", od + "/nw.pak");
								copySync(nd + "/libffmpegsumo.so", od + "/libffmpegsumo.so");

								finish();

							});

							archive.on("error", function(err){
							    throw err;
							});

							archive.pipe(output);
							archive.bulk([{
								expand: true,
								cwd: packOutDir,
								src: ["**"]
							}]);
							archive.finalize();

						} else if (platform == "ejecta") {

							var ejectaSrc = projectBase + "/ejecta";
							if (fs.existsSync(ejectaSrc)) {
								console.log("Using custom Ejecta");
							} else {
								ejectaSrc = platformDir + "/ejecta";
							}

							fs.rmrfSync(outputDir);
							// done with 'cp' because copying with node does not copy symlinks inside ejecta TODO fix
							run("cp -R '" + ejectaSrc + "' '" + outputDir + "'");

							fs.rmrfSync(outputDir + "/App");
							fs.copyRecursive(packOutDir, outputDir + "/App", function(err) {
								if (err) throw err;

								// fonts
								var fontFiles = [];
								if (fs.existsSync(fontDir)) {
									scanFonts(function(name, dir) {
										copySync(dir + "/font.ttf", outputDir + "/Resources/" + name + ".ttf");
										fontFiles.push(name + ".ttf");
									});
								}

								processFile(outputDir + "/Resources/Info.plist", function(txt) {
									var info = plist().parseStringSync(txt);

									if (fontFiles.length != 0)
										info["UIAppFonts"] = fontFiles;

									return plist().build(info).toString();
								});

								finish();
							});


						} else {
							finish();
						}

					}

					function finish() {
						if (!tortArgs.hasOwnProperty("keeptmp"))
							fs.rmrfSync(tmpContainer);
						console.log("Tortilla done");
					}

				}

			}

		}

	};

	var cmd = plainArgs[0];
	if (!cmds.hasOwnProperty(cmd)) {
		console.log("Unknown command " + cmd);
		process.exit(1);
	}
	cmds[cmd].apply(this, plainArgs.slice(1));

	function runAsync(cmd, args, onEnd, env) {

		var opts = {};
		if (env) {
		console.log("env: " + JSON.stringify(env));
			opts.env = env;
		}

		// spawn child
		var spawn = require("child_process").spawn;
	    var proc = spawn(cmd, args, opts);

	    // log output
		var start = Date.now();
		var out = function(data, err) {
			var pref = (err ? "!!!" : "") + "[" + cmd + "][" + (Date.now()-start) + "] ";
			var msg = data.toString();
			if (msg.endsWith("\n")) msg = msg.substring(0, msg.length-1);
			console.log(pref + msg.replace(/\n/g, "\n" + pref));
		};
		proc.stdout.on("data", function(data) {
			out(data, false);
		});
		proc.stderr.on("data", function(data) {
			out(data, true);
		});

		// run callback on end
		proc.on('close', onEnd);

		return proc;

	}

	/**
	 * @deprecated Prefer runAsync
	 */
	function run(cmd, skipOut) {
//		console.log(cmd);
		if (skipOut) {
			execSync()(cmd, false);
		} else {
			var out = execSync()(cmd, true);
//			console.dir(out);
			if (out.stdout.length > 0) console.log(out.stdout);
			if (out.stderr.length > 0) console.log(out.stderr);
//			if (out.hasOwnProperty("code") && out.code != 0) throw "Non-zero return code: " + out.code;
		}
	}

	function processFile(path, processor) {
		var txt = fs.readFileSync(path, "utf8");
		txt = processor(txt);
		fs.writeFileSync(path, txt, "utf8");
	}

	function copySync(from, to) {
		// console.log("copySync", from, "->", to);
		fs.writeFileSync(to, fs.readFileSync(from));
	}

	/**
	 * A version of fs.copyRecursive that supports existing destination dirs (not files).
	 */
	function copyRecursive(from, to, after) {

		var stat = fs.statSync(from);
		if (stat.isFile()) {
			copySync(from, to);
			after(null);
		} else {
			if (!fs.existsSync(to)) {
				fs.copyRecursive(from, to, after);
			} else {
				var files = fs.readdirSync(from);
				var copyNext = function() {
					if (files.length == 0) {
						after(null);
						return;
					}
					var f = files.pop();
					copyRecursive(from + "/" + f, to + "/" + f, function(err) {
						if (err) {
							after(err);
							return;
						} else {
							copyNext();
						}
					});
				};
				copyNext();
			}
		}

	}

}

function pushAll(dest, src) {
	src.forEach(function(f) {
		dest.push(f);
	});
}

function truncate(str, len) {
	return str.substring(0, Math.min(len, str.length));
}

function objProp(obj, prop, fb) {
	return obj.hasOwnProperty(prop) ? obj[prop] : fb;
}

function mustReplace(str, from, to) {
	var rep = str.replace(from, to);
	if (rep == str) throw "Couldn't find '" + from + "' to replace";
	return rep;
}

function seq(steps, done) {
	var queue = steps.slice();
	// console.log(steps);
	(function next() {
		var step = queue.shift();
		if (step == null) {
			done();
		} else {
			step(function(err) {
				if (err) throw err;
				else next();
			});
		}
	})();
}

function eachAsync(list, process, done) {
	var queue = list.slice();
	(function next() {
		var i = queue.shift();
		if (i == null) {
			done();
		} else {
			process(i, function(err) {
				if (err) throw err;
				else next();
			});
		}
	})();
}

// ------------------------ polyfills -------------------------------- //

if (!String.prototype.endsWith) {
	(function() {
		'use strict';
		var defineProperty = (function() {
			try {
				var object = {};
				var $defineProperty = Object.defineProperty;
				var result = $defineProperty(object, object, object)
						&& $defineProperty;
			} catch (error) {
			}
			return result;
		}());
		var toString = {}.toString;
		var endsWith = function(search) {
			if (this == null) {
				throw TypeError();
			}
			var string = String(this);
			if (search && toString.call(search) == '[object RegExp]') {
				throw TypeError();
			}
			var stringLength = string.length;
			var searchString = String(search);
			var searchLength = searchString.length;
			var pos = stringLength;
			if (arguments.length > 1) {
				var position = arguments[1];
				if (position !== undefined) {
					pos = position ? Number(position) : 0;
					if (pos != pos) {
						pos = 0;
					}
				}
			}
			var end = Math.min(Math.max(pos, 0), stringLength);
			var start = end - searchLength;
			if (start < 0) {
				return false;
			}
			var index = -1;
			while (++index < searchLength) {
				if (string.charCodeAt(start + index) != searchString
						.charCodeAt(index)) {
					return false;
				}
			}
			return true;
		};
		if (defineProperty) {
			defineProperty(String.prototype, 'endsWith', {
				'value' : endsWith,
				'configurable' : true,
				'writable' : true
			});
		} else {
			String.prototype.endsWith = endsWith;
		}
	}());
}

runTortilla();
