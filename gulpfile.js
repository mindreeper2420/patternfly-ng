var gulp            = require('gulp'),
    sass            = require('gulp-sass'),
    autoprefixer    = require('autoprefixer'),
    changed         = require('gulp-changed'),
    cssmin          = require('gulp-cssmin'),
    csso            = require('csso'),
    del             = require('del'),
    fs              = require("fs"),
    htmlMinifier    = require('html-minifier'),
    insert          = require('gulp-insert').
    ngc             = require('gulp-ngc'),
    path            = require('path'),
    postcss         = require('postcss'),
    replace         = require('gulp-replace'),
    rename          = require('gulp-rename');
    sassGlob        = require('gulp-sass-glob'),
    sourcemaps      = require('gulp-sourcemaps'),
    stylelint       = require('gulp-stylelint'),
    stylus          = require('stylus');

var appSrc = 'src';
var libraryBuild = 'build';
var libraryDist = 'dist';
var demoDist = 'dist-demo';
var watchDist = 'dist-watch';
var globalExcludes = [ '!./**/example/**', '!./**/example', '!./**/demo/**', '!./**/demo.*' ];

/**
 * FUNCTION LIBRARY
 */

function copyToDist(srcArr) {
  return gulp.src(srcArr.concat(globalExcludes))
    .pipe(gulp.dest(function (file) {
      return libraryDist + file.base.slice(__dirname.length); // save directly to dist
    }));
}

function copyToDemo(srcArr) {
  return gulp.src(srcArr)
    .pipe(gulp.dest(function (file) {
      return demoDist + file.base.slice(__dirname.length); // save directly to demo
    }));
}

function updateWatchDist() {
  return gulp
    .src([libraryDist + '/**'].concat(globalExcludes))
    .pipe(changed(watchDist))
    .pipe(gulp.dest(watchDist));
}

// Build LESS
function transpileLESS(src) {
  return gulp.src(src)
    .pipe(sourcemaps.init())
    .pipe(sass({
      paths: [ path.join(__dirname, 'scss', 'includes') ]
    }))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(function (file) {
      return __dirname + file.base.slice(__dirname.length);
    }));
}

// Build and minify LESS separately
function transpileMinifyLESS(src) {
  return gulp.src(src)
    .pipe(sourcemaps.init())
    .pipe(sass({
      paths: [ path.join(__dirname, 'scss', 'includes') ]
    }))
    .pipe(cssmin().on('error', function(err) {
      console.log(err);
    }))
    .pipe(rename({suffix: '.min'}))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(function (file) {
      return __dirname + file.base.slice(__dirname.length);
    }));
}

// Minify HTML templates
function minifyTemplate(file) {
  try {
    var minifiedFile = htmlMinifier.minify(file, {
      collapseWhitespace: true,
      caseSensitive: true,
      removeComments: true
    });
    return minifiedFile;
  } catch (err) {
    console.log(err);
  }
}

/**
 * TASKS
 */

// Stylelint task
gulp.task('lint-css', function lintCssTask() {
  return gulp
    .src(['./src/assets/stylesheets/*.scss', './src/app/**/*.scss'])
    // .pipe(stylelint({
    //   failAfterError: true,
    //   reporters: [
    //     {formatter: 'string', console: true}
    //   ]
    // }));
});

// Less compilation
gulp.task('transpile-less', ['lint-css'], function () {
  return transpileLESS(appSrc + '/assets/stylesheets/*.scss');
});

// Less compilation and minifiction
gulp.task('min-css', ['copy-assets-less'], function () {
  return transpileMinifyLESS(appSrc + '/assets/stylesheets/*.scss');
});

// Put the files back to normal 'transpile',
gulp.task('build',
  [
    // 'transpile',
    'copy-css',
    'copy-less'
  ]);

// Build the components
gulp.task('transpile', ['inline-template'], function () {
  return ngc('tsconfig-prod.json');
});

// Inline HTML templates in component classes
gulp.task('inline-template', ['copy-css'], function () {
  return gulp.src(['./src/app/**/*.ts'].concat(globalExcludes), {base: './'})
    .pipe(replace(/templateUrl.*\'/g, function (matched) {
      var fileName = matched.match(/\/.*html/g).toString();
      var dirName = this.file.relative.substring(0, this.file.relative.lastIndexOf('/'));
      var fileContent = fs.readFileSync(dirName + fileName, "utf8");
      return 'template: \`' + minifyTemplate(fileContent) + '\`';
    }))
    .pipe(gulp.dest(libraryBuild));
});

// Copy CSS to dist/css
gulp.task('copy-css', ['copy-less'], function () {
  return gulp.src(['./src/assets/stylesheets/*.css'], {base: './src/assets/stylesheets'})
    .pipe(gulp.dest(function (file) {
      return libraryDist + '/css' + file.base.slice(__dirname.length); // save directly to dist
    }));
});

// Copy component LESS to dist/less in a flattened directory
gulp.task('copy-less', ['min-css'], function () {
  return gulp.src(['./src/app/**/*.scss'].concat(globalExcludes))
    .pipe(rename({dirname: ''}))
    .pipe(gulp.dest(libraryDist + '/scss'));
});

// Copy asset LESS to dist/less and replace relative paths for flattened directory
gulp.task('copy-assets-less',['transpile-less'], function () {
  return gulp.src(['./src/assets/stylesheets/*.scss'])
    .pipe(replace(/\.\.\/.\.\/.\.\//g, function () {
      return '../../../../';
    }))
    .pipe(replace(/@import '\.\.\/\.\.\/.*\//g, function () {
      return '@import \'';
    }))
    .pipe(rename({dirname: ''}))
    .pipe(gulp.dest(libraryDist + '/scss'));
});

// Copy example files to dist-demo (e.g., HTML and Typscript for docs)
gulp.task('copy-examples', function () {
  return copyToDemo([
    'src/**/example/*.*'
  ]);
});

gulp.task('copy-watch', ['post-transpile'], function() {
  return updateWatchDist();
});

gulp.task('copy-watch-all', ['build'], function() {
  return updateWatchDist();
});

gulp.task('watch', ['build', 'copy-watch-all'], function () {
  gulp.watch([appSrc + '/app/**/*.ts', '!' + appSrc + '/app/**/*.spec.ts'], ['transpile', 'post-transpile', 'copy-watch']).on('change', function (e) {
    console.log('TypeScript file ' + e.path + ' has been changed. Compiling.');
  });
  gulp.watch([appSrc + '/app/**/*.scss'], ['min-less']).on('change', function (e) {
    console.log(e.path + ' has been changed. Updating.');
    transpileLESS(e.path);
    updateWatchDist();
  });
  gulp.watch([appSrc + '/app/**/*.html']).on('change', function (e) {
    console.log(e.path + ' has been changed. Updating.');
    copyToDist(e.path);
    updateWatchDist();
  });
});
