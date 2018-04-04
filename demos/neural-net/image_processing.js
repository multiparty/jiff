function toDataURL(url) {
  return fetch(url)
      .then((response)=> {
        return response.blob();
      })
      .then(blob=> {
        return URL.createObjectURL(blob);
      });
}

function getBase64Image(img) {
    // Create an empty canvas element
    var canvas_img = document.createElement("canvas_img");
    canvas_img.width = img.width;
    canvas_img.height = img.height;

    // Copy the image contents to the canvas
    var ctx_img = canvas_img.getContext("2d");
    ctx_img.drawImage(img, 0, 0);

    // Get the data-URL formatted image
    // Firefox supports PNG and JPEG. You could check img.src to
    // guess the original format, but be aware the using "image/jpg"
    // will re-encode the image.
    var dataURL = canvas_img.toDataURL("image/png");

    return dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
}

// // function to start showing images
function loadImage() {
	if (fileList.indexOf(fileIndex) < 0) {
		var reader = new FileReader();
		reader.onload = (function(theFile) {
			return function(e) {
				// check if positions already exist in storage
				// Render thumbnail.
				var canvas = document.getElementById('image')
				var cc = canvas.getContext('2d');
				var img = new Image();
				img.onload = function() {
					if (img.height > 500 || img.width > 700) {
						var rel = img.height/img.width;
						var neww = 700;
						var newh = neww*rel;
						if (newh > 500) {
							newh = 500;
							neww = newh/rel;
						}
						canvas.setAttribute('width', neww);
						canvas.setAttribute('height', newh);
						cc.drawImage(img,0,0,neww, newh);
					} else {
						canvas.setAttribute('width', img.width);
						canvas.setAttribute('height', img.height);
						cc.drawImage(img,0,0,img.width, img.height);
					}
					test = getImagePixelValues(img);
				}
				img.src = e.target.result;
			};
		})(fileList[fileIndex]);
		reader.readAsDataURL(fileList[fileIndex]);
		//overlayCC.clearRect(0, 0, 720, 576);
		//document.getElementById('convergence').innerHTML = "";
		//ctrack.reset();
	}
}
// set up file selector and variables to hold selections
var fileList, fileIndex;
if (window.File && window.FileReader && window.FileList) {
	function handleFileSelect(evt) {
		console.log("I'm here")
		var files = evt.target.files;
		fileList = [];
		for (var i = 0;i < files.length;i++) {
			if (!files[i].type.match('image.*')) {
				continue;
			}
			fileList.push(files[i]);
		}
		if (files.length > 0) {
			fileIndex = 0;
		}
		loadImage();
	}
	document.getElementById('files').addEventListener('change', handleFileSelect, false);
} else {
	$('#files').addClass("hide");
	$('#loadimagetext').addClass("hide");
}





function getImagePixelValues(img){
	Jimp.read(img.src).then(function (my_image) {	
	console.log("I'm in JIMP")
		var values = [];
	my_image.scan(0, 0, my_image.bitmap.width, my_image.bitmap.height, function (x, y, idx) {
    // x, y is the position of this pixel on the image
    // idx is the position start position of this rgba tuple in the bitmap Buffer
    // this is the image

    values.push(this.bitmap.data[ idx + 2 ]);
    // var red   = this.bitmap.data[ idx + 0 ];
    // var green = this.bitmap.data[ idx + 1 ];
    // var blue  = this.bitmap.data[ idx + 2 ];
    // var alpha = this.bitmap.data[ idx + 3 ];

    // rgba values run from 0 - 255
    // e.g. this.bitmap.data[idx] = 0; // removes red from this pixel
	});
		// for (var i = 0; i < 28; i++){
		// 	var arr = []
		// 	for (var j = 0; j < 28; j++){
		// 		arr.push(values[(28* i) + j]);
		// 	}
		// 	console.log(i, arr);
		// }
		pca_result = numeric.transpose(numeric.dot(numeric.transpose(matrix_w), numeric.transpose([values])));
		console.log(pca_result);
		return pca_result;
	}).catch(function (err) {
	    console.error(err);
	});
}