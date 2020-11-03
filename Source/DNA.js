

var viewer = new Cesium.Viewer('cesiumContainer', {
	homeButton: false, //home button
	fullscreenButton: false, // fullscreen button
	navigationHelpButton: false, // questionmark button
	infoBox: false, //model info box
	sceneModePicker: false, // x-ray globe button
	geocoder: false, // spyglass button
	baseLayerPicker: false, // bing maps button
	animation: true, // "clock"
	timeline: true, // "timeline bar"
});
function randomCoordinateJitter(degree, margin) {
	return degree + margin * (Math.random() - 0.5) / 0.5;
}

for (var i = 0; i <= 500; i++) {
		var entity = viewer.entities.add({
				position : Cesium.Cartesian3.fromDegrees(
						randomCoordinateJitter(-77.009003, 180),
						randomCoordinateJitter(38.889931, 180)
				),
				ellipsoid:{
					radii: new Cesium.Cartesian3(200000.0, 200000.0, 200000.0),
					innerRadii: new Cesium.Cartesian3(150000.0, 150000.0, 150000.0),
					minimumCone: Cesium.Math.toRadians(20.0),
					maximumCone: Cesium.Math.toRadians(70.0),
					material: Cesium.Color.GREEN.withAlpha(0.3),
					outline: true,
				},
		});
}


// Position camera to show all entities
viewer.zoomTo(viewer.entities);
