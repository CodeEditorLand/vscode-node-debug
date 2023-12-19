/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const gulp = require("gulp");
const path = require("path");
const ts = require("gulp-typescript");
const sourcemaps = require("gulp-sourcemaps");
const tslint = require("gulp-tslint");
const filter = require("gulp-filter");
const uglify = require("gulp-uglify");
const del = require("del");
const typescript = require("typescript");

const tsProject = ts.createProject("./src/tsconfig.json", { typescript });
const nls = require("vscode-nls-dev");

const inlineMap = true;
const inlineSource = false;

const watchedSources = ["src/**/*", "!src/tests/data/**"];

const scripts = ["src/node/terminateProcess.sh"];

const scripts2 = ["src/node/debugInjection.js"];

const outDest = "out";
const webPackedDest = "dist";

const transifexProjectName = "vscode-extensions";
const transifexExtensionName = "vscode-node-debug";

gulp.task("clean", () => {
	return del([
		"out/**",
		"dist/**",
		"package.nls.*.json",
		"node-debug-*.vsix",
		"package-lock.json",
	]);
});

gulp.task("internal-compile", () => {
	return compile();
});

gulp.task("internal-copy-scripts", () => {
	return gulp.src(scripts).pipe(gulp.dest(`${outDest}/node`));
});

gulp.task("internal-minify-scripts", () => {
	return gulp
		.src(scripts2)
		.pipe(uglify())
		.pipe(gulp.dest(`${outDest}/node`));
});

// compile and copy everything to outDest
gulp.task(
	"internal-build",
	gulp.series(
		"internal-compile",
		"internal-copy-scripts",
		"internal-minify-scripts",
		(done) => {
			done();
		},
	),
);

gulp.task(
	"build",
	gulp.series("clean", "internal-build", (done) => {
		done();
	}),
);

gulp.task(
	"default",
	gulp.series("build", (done) => {
		done();
	}),
);

gulp.task(
	"compile",
	gulp.series("clean", "internal-build", (done) => {
		done();
	}),
);

gulp.task("nls-bundle-create", () => {
	const r = tsProject
		.src()
		.pipe(sourcemaps.init())
		.pipe(tsProject())
		.js.pipe(nls.createMetaDataFiles())
		.pipe(nls.bundleMetaDataFiles("ms-vscode.node-debug", webPackedDest))
		.pipe(nls.bundleLanguageFiles())
		.pipe(filter("**/nls.*.json"));

	return r.pipe(gulp.dest(webPackedDest));
});

gulp.task(
	"prepare-for-webpack",
	gulp.series(
		"clean",
		"internal-minify-scripts",
		"nls-bundle-create",
		(done) => {
			done();
		},
	),
);

gulp.task(
	"watch",
	gulp.series("internal-build", (done) => {
		//log('Watching build sources...');
		gulp.watch(watchedSources, gulp.series("internal-build"));
		done();
	}),
);

gulp.task(
	"translations-export",
	gulp.series("build", "prepare-for-webpack", () => {
		return gulp
			.src([
				"package.nls.json",
				path.join(webPackedDest, "nls.metadata.header.json"),
				path.join(webPackedDest, "nls.metadata.json"),
			])
			.pipe(
				nls.createXlfFiles(
					transifexProjectName,
					transifexExtensionName,
				),
			)
			.pipe(gulp.dest(path.join("..", "vscode-translations-export")));
	}),
);

//---- internal

function compile() {
	let r = tsProject.src().pipe(sourcemaps.init()).pipe(tsProject()).js;

	if (inlineMap && inlineSource) {
		r = r.pipe(sourcemaps.write());
	} else {
		r = r.pipe(
			sourcemaps.write("../out", {
				// no inlined source
				includeContent: inlineSource,
				// Return relative source map root directories per file.
				sourceRoot: "../src",
			}),
		);
	}

	return r.pipe(gulp.dest(outDest));
}

const allTypeScript = ["src/**/*.ts"];

const tslintFilter = ["**", "!**/*.d.ts"];

gulp.task("tslint", (done) => {
	gulp.src(allTypeScript)
		.pipe(filter(tslintFilter))
		.pipe(
			tslint({
				formatter: "prose",
				rulesDirectory: "node_modules/tslint-microsoft-contrib",
			}),
		)
		.pipe(
			tslint.report({
				emitError: false,
			}),
		);
	done();
});
