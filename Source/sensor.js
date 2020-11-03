
import { defined } from './defined.js';

var CustomSensorVolumeVS = function(){
return "attribute vec4 position;"+
"attribute vec3 normal;"+
"varying vec3 v_positionWC;"+
"varying vec3 v_positionEC;"+
"varying vec3 v_normalEC;"+
"void main(){"+
"gl_Position = czm_modelViewProjection * position;" +
"v_positionWC = (czm_model * position).xyz;"+
"v_positionEC = (czm_modelView * position).xyz;"+
"v_normalEC = czm_normal * normal;}";
}

var CustomSensorVolumeFS = function(){
return '#ifdef GL_OES_standard_derivatives\n    #extension GL_OES_standard_derivatives : enable\n#endif  \n\nuniform bool u_showIntersection;\nuniform bool u_showThroughEllipsoid;\n\nuniform float u_sensorRadius;\nuniform float u_normalDirection;\n\nvarying vec3 v_positionWC;\nvarying vec3 v_positionEC;\nvarying vec3 v_normalEC;\n\nvec4 getColor(float sensorRadius, vec3 pointEC)\n{\n    czm_materialInput materialInput;\n    \n    vec3 pointMC = (czm_inverseModelView * vec4(pointEC, 1.0)).xyz;'+
" materialInput.st = sensor2dTextureCoordinates(sensorRadius, pointMC);"+
" materialInput.str = pointMC / sensorRadius;"+
" vec3 positionToEyeEC = -v_positionEC;"+
" materialInput.positionToEyeEC = positionToEyeEC;"+
" vec3 normalEC = normalize(v_normalEC);"+
" materialInput.normalEC = u_normalDirection * normalEC;"+
" czm_material material = czm_getMaterial(materialInput);"+
" return  mix(czm_phong(normalize(positionToEyeEC), material, normalize(positionToEyeEC)), vec4(material.diffuse, material.alpha), 0.4);"+
" }"+
" bool isOnBoundary(float value, float epsilon)"+
" {float width = getIntersectionWidth();"+
" float tolerance = width * epsilon;"+
" float delta = max(abs(dFdx(value)), abs(dFdy(value)));"+
" float pixels = width * delta;"+
" float temp = abs(value);"+
" return temp < tolerance && temp < pixels || (delta < 10.0 * tolerance && temp - delta < tolerance && temp < pixels);"+

" }"+
" vec4 shade(bool isOnBoundary)"+
" {if (u_showIntersection && isOnBoundary)"+
" {return getIntersectionColor();}"+
" return getColor(u_sensorRadius, v_positionEC);}"+
" float ellipsoidSurfaceFunction(vec3 point)"+
" {vec3 scaled = czm_ellipsoidInverseRadii * point;"+
" return dot(scaled, scaled) - 1.0;"+
" }void main(){ vec3 sensorVertexWC = czm_model[3].xyz;"+
" vec3 sensorVertexEC = czm_modelView[3].xyz;"+
" float ellipsoidValue = ellipsoidSurfaceFunction(v_positionWC);"+
" if (!u_showThroughEllipsoid){"+
" if (ellipsoidValue < 0.0){discard;}"+
" if (inSensorShadow(sensorVertexWC, v_positionWC)){discard;}}"+
" if (distance(v_positionEC, sensorVertexEC) > u_sensorRadius)"+
" {discard;}"+
" bool isOnEllipsoid = isOnBoundary(ellipsoidValue, czm_epsilon3);"+
" gl_FragColor = shade(isOnEllipsoid);}";
}

var ShadersSensorVolume = function(){
return "vec4 u_intersectionColor;"+
" float u_intersectionWidth;"+
" bool inSensorShadow(vec3 coneVertexWC, vec3 pointWC)"+
"{vec3 D = czm_ellipsoidInverseRadii;"+
"vec3 q = D * coneVertexWC;"+
"float qMagnitudeSquared = dot(q, q);"+
"float test = qMagnitudeSquared - 1.0;"+
"vec3 temp = D * pointWC - q;"+
"float d = dot(temp, q);"+
"return (d < -test) && (d / length(temp) < -sqrt(test));}"+
"vec4 getIntersectionColor(){return u_intersectionColor;}"+
"float getIntersectionWidth(){return u_intersectionWidth;}"+
"vec2 sensor2dTextureCoordinates(float sensorRadius, vec3 pointMC){"+
"float t = pointMC.z / sensorRadius;"+
"float s = 1.0 + (atan(pointMC.y, pointMC.x) / czm_twoPi);"+
"s = s - floor(s); return vec2(s, t);}";
}


var definePropertyWorks = (function() {
      try {
          return 'x' in Object.defineProperty({}, 'x', {});
      } catch (e) {
          return false;
      }
  })();

/**
 * Defines properties on an object, using Object.defineProperties if available,
 * otherwise returns the object unchanged.  This function should be used in
 * setup code to prevent errors from completely halting JavaScript execution
 * in legacy browsers.
 *
 * @private
 *
 * @exports defineProperties
 */
var defineProperties = Object.defineProperties;
if (!definePropertyWorks || !defined(defineProperties)) {
    defineProperties = function(o) {
        return o;
    };
}


var CustomSensorVolume = function(){};

(function() {

    var attributeLocations = {
        position : 0,
        normal : 1
    };

    var FAR = 5906376272000.0;  // distance from the Sun to Pluto in meters.

    /**
     * DOC_TBA
     *
     * @alias CustomSensorVolume
     * @constructor
     */
     CustomSensorVolume = function(options) {
        options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);


        this._pickId = undefined;
        this._pickPrimitive = Cesium.defaultValue(options._pickPrimitive, this);

        this._frontFaceColorCommand = new Cesium.DrawCommand();
        this._backFaceColorCommand = new  Cesium.DrawCommand();
        this._pickCommand = new  Cesium.DrawCommand();

        this._boundingSphere = new  Cesium.BoundingSphere();
        this._boundingSphereWC = new  Cesium.BoundingSphere();

        this._frontFaceColorCommand.primitiveType =  Cesium.PrimitiveType.TRIANGLES;
        this._frontFaceColorCommand.boundingVolume = this._boundingSphereWC;
        this._frontFaceColorCommand.owner = this;

        this._backFaceColorCommand.primitiveType = this._frontFaceColorCommand.primitiveType;
        this._backFaceColorCommand.boundingVolume = this._frontFaceColorCommand.boundingVolume;
        this._backFaceColorCommand.owner = this;

        this._pickCommand.primitiveType = this._frontFaceColorCommand.primitiveType;
        this._pickCommand.boundingVolume = this._frontFaceColorCommand.boundingVolume;
        this._pickCommand.owner = this;


        /**
         * <code>true</code> if this sensor will be shown; otherwise, <code>false</code>
         *
         * @type {Boolean}
         * @default true
         */
        this.show = Cesium.defaultValue(options.show, true);

        /**
         * When <code>true</code>, a polyline is shown where the sensor outline intersections the globe.
         *
         * @type {Boolean}
         *
         * @default true
         *
         * @see CustomSensorVolume#intersectionColor
         */
        this.showIntersection = Cesium.defaultValue(options.showIntersection, true);

        /**
         * <p>
         * Determines if a sensor intersecting the ellipsoid is drawn through the ellipsoid and potentially out
         * to the other side, or if the part of the sensor intersecting the ellipsoid stops at the ellipsoid.
         * </p>
         *
         * @type {Boolean}
         * @default false
         */
        this.showThroughEllipsoid = Cesium.defaultValue(options.showThroughEllipsoid, false);
        this._showThroughEllipsoid = this.showThroughEllipsoid;

        /**
         * The 4x4 transformation matrix that transforms this sensor from model to world coordinates.  In it's model
         * coordinates, the sensor's principal direction is along the positive z-axis.  The clock angle, sometimes
         * called azimuth, is the angle in the sensor's X-Y plane measured from the positive X-axis toward the positive
         * Y-axis.  The cone angle, sometimes called elevation, is the angle out of the X-Y plane along the positive Z-axis.
         * <br /><br />
         * <div align='center'>
         * <img src='images/CustomSensorVolume.setModelMatrix.png' /><br />
         * Model coordinate system for a custom sensor
         * </div>
         *
         * @type {Matrix4}
         * @default {@link Matrix4.IDENTITY}
         *
         * @example
         * // The sensor's vertex is located on the surface at -75.59777 degrees longitude and 40.03883 degrees latitude.
         * // The sensor's opens upward, along the surface normal.
         * var center = Cesium.Cartesian3.fromDegrees(-75.59777, 40.03883);
         * sensor.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(center);
         */
        this.modelMatrix = Cesium.Matrix4.clone(Cesium.defaultValue(options.modelMatrix, Cesium.Matrix4.IDENTITY));
        this._modelMatrix = new Cesium.Matrix4();

        /**
         * DOC_TBA
         *
         * @type {Number}
         * @default {@link Number.POSITIVE_INFINITY}
         */
        this.radius = Cesium.defaultValue(options.radius, Number.POSITIVE_INFINITY);

        this._directions = undefined;
        this._directionsDirty = false;
        this.directions = defined(options.directions) ? options.directions : [];


        /**
         * The surface appearance of the sensor.  This can be one of several built-in {@link Material} objects or a custom material, scripted with
         * {@link https://github.com/AnalyticalGraphicsInc/cesium/wiki/Fabric|Fabric}.
         * <p>
         * The default material is <code>Material.ColorType</code>.
         * </p>
         *
         * @type {Material}
         * @default Material.fromType(Material.ColorType)
         *
         * @see {@link https://github.com/AnalyticalGraphicsInc/cesium/wiki/Fabric|Fabric}
         *
         * @example
         * // 1. Change the color of the default material to yellow
         * sensor.lateralSurfaceMaterial.uniforms.color = new Cesium.Color(1.0, 1.0, 0.0, 1.0);
         *
         * // 2. Change material to horizontal stripes
         * sensor.lateralSurfaceMaterial = Cesium.Material.fromType(Material.StripeType);
         */
        this.lateralSurfaceMaterial = defined(options.lateralSurfaceMaterial) ? options.lateralSurfaceMaterial : Cesium.Material.fromType(Cesium.Material.ColorType);
        this._lateralSurfaceMaterial = undefined;
        this._translucent = undefined;

        /**
         * The color of the polyline where the sensor outline intersects the globe.  The default is {@link Color.WHITE}.
         *
         * @type {Color}
         * @default {@link Color.WHITE}
         *
         * @see CustomSensorVolume#showIntersection
         */
        this.intersectionColor = Cesium.Color.clone(Cesium.defaultValue(options.intersectionColor, Cesium.Color.WHITE));

        /**
         * The approximate pixel width of the polyline where the sensor outline intersects the globe.  The default is 5.0.
         *
         * @type {Number}
         * @default 5.0
         *
         * @see CustomSensorVolume#showIntersection
         */
        this.intersectionWidth = Cesium.defaultValue(options.intersectionWidth, 5.0);

        /**
         * User-defined object returned when the sensors is picked.
         *
         * @type Object
         *
         * @default undefined
         *
         * @see Scene#pick
         */
        this.id = options.id;
        this._id = undefined;

        var that = this;
        this._uniforms = {
            u_showThroughEllipsoid : function() {
                return that.showThroughEllipsoid;
            },
            u_showIntersection : function() {
                return that.showIntersection;
            },
            u_sensorRadius : function() {
                return isFinite(that.radius) ? that.radius : FAR;
            },
            u_intersectionColor : function() {
                return that.intersectionColor;
            },
            u_intersectionWidth : function() {
                return that.intersectionWidth;
            },
            u_normalDirection : function() {
                return 1.0;
            }
        };

        this._mode = Cesium.SceneMode.SCENE3D;
    };

    defineProperties(CustomSensorVolume.prototype, {
        directions : {
            get : function() {
                return this._directions;
            },
            set : function(value) {
                this._directions = value;
                this._directionsDirty = true;
            }
        }
    });

    var n0Scratch = new Cesium.Cartesian3();
    var n1Scratch = new Cesium.Cartesian3();
    var n2Scratch = new Cesium.Cartesian3();
    function computePositions(customSensorVolume) {
        var directions = customSensorVolume._directions;
        var length = directions.length;
        var positions = new Float32Array(3 * length);
        var r = isFinite(customSensorVolume.radius) ? customSensorVolume.radius : FAR;

        var boundingVolumePositions = [Cesium.Cartesian3.ZERO];

        for ( var i = length - 2, j = length - 1, k = 0; k < length; i = j++, j = k++) {
            // PERFORMANCE_IDEA:  We can avoid redundant operations for adjacent edges.
            var n0 = Cesium.Cartesian3.fromSpherical(directions[i], n0Scratch);
            var n1 = Cesium.Cartesian3.fromSpherical(directions[j], n1Scratch);
            var n2 = Cesium.Cartesian3.fromSpherical(directions[k], n2Scratch);

            // Extend position so the volume encompasses the sensor's radius.
            var theta = Math.max(Cesium.Cartesian3.angleBetween(n0, n1), Cesium.Cartesian3.angleBetween(n1, n2));
            var distance = r / Math.cos(theta * 0.5);
            var p = Cesium.Cartesian3.multiplyByScalar(n1, distance, new Cesium.Cartesian3());

            positions[(j * 3)] = p.x;
            positions[(j * 3) + 1] = p.y;
            positions[(j * 3) + 2] = p.z;

            boundingVolumePositions.push(p);
        }

        Cesium.BoundingSphere.fromPoints(boundingVolumePositions, customSensorVolume._boundingSphere);

        return positions;
    }

    var nScratch = new Cesium.Cartesian3();
    function createVertexArray(customSensorVolume, context) {
        var positions = computePositions(customSensorVolume);

        var length = customSensorVolume._directions.length;
        var vertices = new Float32Array(2 * 3 * 3 * length);

        var k = 0;
        for ( var i = length - 1, j = 0; j < length; i = j++) {
            var p0 = new Cesium.Cartesian3(positions[(i * 3)], positions[(i * 3) + 1], positions[(i * 3) + 2]);
            var p1 = new Cesium.Cartesian3(positions[(j * 3)], positions[(j * 3) + 1], positions[(j * 3) + 2]);

            var n = (JSON.stringify(Cesium.Cartesian3.cross(p1, p0, nScratch)) !== JSON.stringify(nScratch)) ?
                Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(p1, p0, nScratch), nScratch) :  {}; // Per-face normals

            if (n == {}) {continue}

            vertices[k++] = 0.0; // Sensor vertex
            vertices[k++] = 0.0;
            vertices[k++] = 0.0;
            vertices[k++] = n.x;
            vertices[k++] = n.y;
            vertices[k++] = n.z;

            vertices[k++] = p1.x;
            vertices[k++] = p1.y;
            vertices[k++] = p1.z;
            vertices[k++] = n.x;
            vertices[k++] = n.y;
            vertices[k++] = n.z;

            vertices[k++] = p0.x;
            vertices[k++] = p0.y;
            vertices[k++] = p0.z;
            vertices[k++] = n.x;
            vertices[k++] = n.y;
            vertices[k++] = n.z;
        }


        var vertexBuffer = Cesium.Buffer.createVertexBuffer({
                context : context,
                typedArray : new Float32Array(vertices),
                usage : Cesium.BufferUsage.STATIC_DRAW});

        var stride = 2 * 3 * Float32Array.BYTES_PER_ELEMENT;

        var attributes = [{
            index : attributeLocations.position,
            enabled: true,
            vertexBuffer : vertexBuffer,
            componentsPerAttribute : 3,
            componentDatatype : Cesium.ComponentDatatype.FLOAT,
            normalize : false,
            offsetInBytes : 0,
            strideInBytes : stride,
            instanceDivisor: 0
        }, {
            index : attributeLocations.normal,
            enabled: true,
            vertexBuffer : vertexBuffer,
            componentsPerAttribute : 3,
            componentDatatype : Cesium.ComponentDatatype.FLOAT,
            normalize : false,
            offsetInBytes : 3 * Float32Array.BYTES_PER_ELEMENT,
            strideInBytes : stride,
            instanceDivisor: 0
        }];


        return new Cesium.VertexArray({context : context,
                                  attributes:attributes})
    }

    /**
     * Called when {@link Viewer} or {@link CesiumWidget} render the scene to
     * get the draw commands needed to render this primitive.
     * <p>
     * Do not call this function directly.  This is documented just to
     * list the exceptions that may be propagated when the scene is rendered:
     * </p>
     *
     * @exception {DeveloperError} this.radius must be greater than or equal to zero.
     * @exception {DeveloperError} this.lateralSurfaceMaterial must be defined.
     */
    CustomSensorVolume.prototype.update = function(options) {
        this._mode = Cesium.SceneMode.SCENE3D;


        if (!this.show || this._mode !== Cesium.SceneMode.SCENE3D) {
            return;
        }

        var translucent = this.lateralSurfaceMaterial.isTranslucent();

        // Initial render state creation
        if ((this._showThroughEllipsoid !== this.showThroughEllipsoid) ||
                (!defined(this._frontFaceColorCommand.renderState)) ||
                (this._translucent !== translucent)) {

            this._showThroughEllipsoid = this.showThroughEllipsoid;
            this._translucent = translucent;

            var rs;

            if (translucent) {

                rs = Cesium.RenderState.fromCache({
                   frontFace : Cesium.WindingOrder.COUNTER_CLOCKWISE,
                   cull : {
                       enabled : false,
                       face : Cesium.CullFace.BACK
                   },
                   lineWidth : 1,
                   polygonOffset : {
                       enabled : false,
                       factor : 0,
                       units : 0
                   },
                   scissorTest : {
                       enabled : false,
                       rectangle : {
                           x : 0,
                           y : 0,
                           width : 0,
                           height : 0
                       }
                   },
                   depthRange : {
                       near : 0,
                       far : 1
                   },
                   depthTest : {
                       enabled : !this.showThroughEllipsoid,
                       func : Cesium.DepthFunction.LESS
                    },
                   colorMask : {
                       red : true,
                       green : true,
                       blue : true,
                       alpha : true
                   },
                   depthMask : false,
                   stencilMask : ~0,
                   blending : {
                       enabled : false,
                       color : {
                           red : 0.0,
                           green : 0.0,
                           blue : 0.0,
                           alpha : 0.0
                       },
                       equationRgb : Cesium.BlendEquation.ADD,
                       equationAlpha : Cesium.BlendEquation.ADD,
                       functionSourceRgb : Cesium.BlendFunction.ONE,
                       functionSourceAlpha : Cesium.BlendFunction.ONE,
                       functionDestinationRgb : Cesium.BlendFunction.ZERO,
                       functionDestinationAlpha : Cesium.BlendFunction.ZERO
                   },
                   stencilTest : {
                       enabled : false,
                       frontFunction : Cesium.StencilFunction.ALWAYS,
                       backFunction : Cesium.StencilFunction.ALWAYS,
                       reference : 0,
                       mask : ~0,
                       frontOperation : {
                           fail : Cesium.StencilOperation.KEEP,
                           zFail : Cesium.StencilOperation.KEEP,
                           zPass : Cesium.StencilOperation.KEEP
                       },
                       backOperation : {
                           fail : Cesium.StencilOperation.KEEP,
                           zFail : Cesium.StencilOperation.KEEP,
                           zPass : Cesium.StencilOperation.KEEP
                       }
                   },
                   sampleCoverage : {
                       enabled : false,
                       value : 1.0,
                       invert : false
                    }
                });

                this._frontFaceColorCommand.renderState = rs;
                this._frontFaceColorCommand.pass = Cesium.Pass.TRANSLUCENT;

                rs = Cesium.RenderState.fromCache({
                   frontFace : Cesium.WindingOrder.COUNTER_CLOCKWISE,
                   cull : {
                       enabled : true,
                       face : Cesium.CullFace.FRONT
                   },
                   lineWidth : 1,
                   polygonOffset : {
                       enabled : false,
                       factor : 0,
                       units : 0
                   },
                   scissorTest : {
                       enabled : false,
                       rectangle : {
                           x : 0,
                           y : 0,
                           width : 0,
                           height : 0
                       }
                   },
                   depthRange : {
                       near : 0,
                       far : 1
                   },
                   depthTest : {
                       enabled : !this.showThroughEllipsoid,
                       func : Cesium.DepthFunction.LESS
                    },
                   colorMask : {
                       red : true,
                       green : true,
                       blue : true,
                       alpha : true
                   },
                   depthMask : false,
                   stencilMask : ~0,
                   blending : {
                       enabled : false,
                       color : {
                           red : 0.0,
                           green : 0.0,
                           blue : 0.0,
                           alpha : 0.0
                       },
                       equationRgb : Cesium.BlendEquation.ADD,
                       equationAlpha : Cesium.BlendEquation.ADD,
                       functionSourceRgb : Cesium.BlendFunction.ONE,
                       functionSourceAlpha : Cesium.BlendFunction.ONE,
                       functionDestinationRgb : Cesium.BlendFunction.ZERO,
                       functionDestinationAlpha : Cesium.BlendFunction.ZERO
                   },
                   stencilTest : {
                       enabled : false,
                       frontFunction : Cesium.StencilFunction.ALWAYS,
                       backFunction : Cesium.StencilFunction.ALWAYS,
                       reference : 0,
                       mask : ~0,
                       frontOperation : {
                           fail : Cesium.StencilOperation.KEEP,
                           zFail : Cesium.StencilOperation.KEEP,
                           zPass : Cesium.StencilOperation.KEEP
                       },
                       backOperation : {
                           fail : Cesium.StencilOperation.KEEP,
                           zFail : Cesium.StencilOperation.KEEP,
                           zPass : Cesium.StencilOperation.KEEP
                       }
                   },
                   sampleCoverage : {
                       enabled : false,
                       value : 1.0,
                       invert : false
                    }
                });



                this._backFaceColorCommand.renderState = rs;
                this._backFaceColorCommand.pass = Cesium.Pass.TRANSLUCENT;


                rs = Cesium.RenderState.fromCache({
                   frontFace : Cesium.WindingOrder.COUNTER_CLOCKWISE,
                   cull : {
                       enabled : true,
                       face : Cesium.CullFace.FRONT
                   },
                   lineWidth : 1,
                   polygonOffset : {
                       enabled : false,
                       factor : 0,
                       units : 0
                   },
                   scissorTest : {
                       enabled : false,
                       rectangle : {
                           x : 0,
                           y : 0,
                           width : 0,
                           height : 0
                       }
                   },
                   depthRange : {
                       near : 0,
                       far : 1
                   },
                   depthTest : {
                       enabled : !this.showThroughEllipsoid,
                       func : Cesium.DepthFunction.LESS
                    },
                   colorMask : {
                       red : true,
                       green : true,
                       blue : true,
                       alpha : true
                   },
                   depthMask : false,
                   stencilMask : ~0,
                   blending : {
                       enabled : false,
                       color : {
                           red : 0.0,
                           green : 0.0,
                           blue : 0.0,
                           alpha : 0.0
                       },
                       equationRgb : Cesium.BlendEquation.ADD,
                       equationAlpha : Cesium.BlendEquation.ADD,
                       functionSourceRgb : Cesium.BlendFunction.ONE,
                       functionSourceAlpha : Cesium.BlendFunction.ONE,
                       functionDestinationRgb : Cesium.BlendFunction.ZERO,
                       functionDestinationAlpha : Cesium.BlendFunction.ZERO
                   },
                   stencilTest : {
                       enabled : false,
                       frontFunction : Cesium.StencilFunction.ALWAYS,
                       backFunction : Cesium.StencilFunction.ALWAYS,
                       reference : 0,
                       mask : ~0,
                       frontOperation : {
                           fail : Cesium.StencilOperation.KEEP,
                           zFail : Cesium.StencilOperation.KEEP,
                           zPass : Cesium.StencilOperation.KEEP
                       },
                       backOperation : {
                           fail : Cesium.StencilOperation.KEEP,
                           zFail : Cesium.StencilOperation.KEEP,
                           zPass : Cesium.StencilOperation.KEEP
                       }
                   },
                   sampleCoverage : {
                       enabled : false,
                       value : 1.0,
                       invert : false
                    }
                });


                this._pickCommand.renderState = rs;
            } else {

                rs = Cesium.RenderState.fromCache({
                   frontFace : Cesium.WindingOrder.COUNTER_CLOCKWISE,
                   cull : {
                       enabled : true,
                       face : Cesium.CullFace.FRONT
                   },
                   lineWidth : 1,
                   polygonOffset : {
                       enabled : false,
                       factor : 0,
                       units : 0
                   },
                   scissorTest : {
                       enabled : false,
                       rectangle : {
                           x : 0,
                           y : 0,
                           width : 0,
                           height : 0
                       }
                   },
                   depthRange : {
                       near : 0,
                       far : 1
                   },
                   depthTest : {
                       enabled : true,
                       func : Cesium.DepthFunction.LESS
                    },
                   colorMask : {
                       red : true,
                       green : true,
                       blue : true,
                       alpha : true
                   },
                   depthMask : true,
                   stencilMask : ~0,
                   blending : {
                       enabled : false,
                       color : {
                           red : 0.0,
                           green : 0.0,
                           blue : 0.0,
                           alpha : 0.0
                       },
                       equationRgb : Cesium.BlendEquation.ADD,
                       equationAlpha : Cesium.BlendEquation.ADD,
                       functionSourceRgb : Cesium.BlendFunction.ONE,
                       functionSourceAlpha : Cesium.BlendFunction.ONE,
                       functionDestinationRgb : Cesium.BlendFunction.ZERO,
                       functionDestinationAlpha : Cesium.BlendFunction.ZERO
                   },
                   stencilTest : {
                       enabled : false,
                       frontFunction : Cesium.StencilFunction.ALWAYS,
                       backFunction : Cesium.StencilFunction.ALWAYS,
                       reference : 0,
                       mask : ~0,
                       frontOperation : {
                           fail : Cesium.StencilOperation.KEEP,
                           zFail : Cesium.StencilOperation.KEEP,
                           zPass : Cesium.StencilOperation.KEEP
                       },
                       backOperation : {
                           fail : Cesium.StencilOperation.KEEP,
                           zFail : Cesium.StencilOperation.KEEP,
                           zPass : Cesium.StencilOperation.KEEP
                       }
                   },
                   sampleCoverage : {
                       enabled : false,
                       value : 1.0,
                       invert : false
                    }
                });

                this._frontFaceColorCommand.renderState = rs;
                this._frontFaceColorCommand.pass = Pass.OPAQUE;

                rs = Cesium.RenderState.fromCache({
                   frontFace : Cesium.WindingOrder.COUNTER_CLOCKWISE,
                   cull : {
                       enabled : true,
                       face : Cesium.CullFace.FRONT
                   },
                   lineWidth : 1,
                   polygonOffset : {
                       enabled : false,
                       factor : 0,
                       units : 0
                   },
                   scissorTest : {
                       enabled : false,
                       rectangle : {
                           x : 0,
                           y : 0,
                           width : 0,
                           height : 0
                       }
                   },
                   depthRange : {
                       near : 0,
                       far : 1
                   },
                   depthTest : {
                       enabled : true,
                       func : Cesium.DepthFunction.LESS
                    },
                   colorMask : {
                       red : true,
                       green : true,
                       blue : true,
                       alpha : true
                   },
                   depthMask : true,
                   stencilMask : ~0,
                   blending : {
                       enabled : false,
                       color : {
                           red : 0.0,
                           green : 0.0,
                           blue : 0.0,
                           alpha : 0.0
                       },
                       equationRgb : Cesium.BlendEquation.ADD,
                       equationAlpha : Cesium.BlendEquation.ADD,
                       functionSourceRgb : Cesium.BlendFunction.ONE,
                       functionSourceAlpha : Cesium.BlendFunction.ONE,
                       functionDestinationRgb : Cesium.BlendFunction.ZERO,
                       functionDestinationAlpha : Cesium.BlendFunction.ZERO
                   },
                   stencilTest : {
                       enabled : false,
                       frontFunction : Cesium.StencilFunction.ALWAYS,
                       backFunction : Cesium.StencilFunction.ALWAYS,
                       reference : 0,
                       mask : ~0,
                       frontOperation : {
                           fail : Cesium.StencilOperation.KEEP,
                           zFail : Cesium.StencilOperation.KEEP,
                           zPass : Cesium.StencilOperation.KEEP
                       },
                       backOperation : {
                           fail : Cesium.StencilOperation.KEEP,
                           zFail : Cesium.StencilOperation.KEEP,
                           zPass : Cesium.StencilOperation.KEEP
                       }
                   },
                   sampleCoverage : {
                       enabled : false,
                       value : 1.0,
                       invert : false
                    }
                });

                this._pickCommand.renderState = rs;
            }

        }

        // Recreate vertex buffer when directions change
        var directionsChanged = this._directionsDirty;
        if (directionsChanged) {
            this._directionsDirty = false;
            this._va = this._va && this._va.destroy();

            var directions = this._directions;
            if (directions && (directions.length >= 3)) {
                this._frontFaceColorCommand.vertexArray = createVertexArray(this, options.context);
                this._backFaceColorCommand.vertexArray = this._frontFaceColorCommand.vertexArray;
                this._pickCommand.vertexArray = this._frontFaceColorCommand.vertexArray;
            }
        }

        if (!defined(this._frontFaceColorCommand.vertexArray)) {
            return;
        }

        var pass = options.passes;

        var modelMatrixChanged = !Cesium.Matrix4.equals(this.modelMatrix, this._modelMatrix);
        if (modelMatrixChanged) {
            Cesium.Matrix4.clone(this.modelMatrix, this._modelMatrix);
        }

        if (directionsChanged || modelMatrixChanged) {
            Cesium.BoundingSphere.transform(this._boundingSphere, this.modelMatrix, this._boundingSphereWC);
        }

        this._frontFaceColorCommand.modelMatrix = this.modelMatrix;
        this._backFaceColorCommand.modelMatrix = this._frontFaceColorCommand.modelMatrix;
        this._pickCommand.modelMatrix = this._frontFaceColorCommand.modelMatrix;

        var materialChanged = this._lateralSurfaceMaterial !== this.lateralSurfaceMaterial;
        this._lateralSurfaceMaterial = this.lateralSurfaceMaterial;
        this._lateralSurfaceMaterial.update(options.context);

        if (pass.render) {
            var frontFaceColorCommand = this._frontFaceColorCommand;
            var backFaceColorCommand = this._backFaceColorCommand;

            // Recompile shader when material changes
            if (materialChanged || !defined(frontFaceColorCommand.shaderProgram)) {
                var fsSource = new Cesium.ShaderSource({
                  sources : [ShadersSensorVolume(),  this._lateralSurfaceMaterial.shaderSource, CustomSensorVolumeFS()]
                });

                frontFaceColorCommand.shaderProgram = options.context.shaderCache.replaceShaderProgram({
                  sharedProgram: frontFaceColorCommand.shaderProgram,
                  vertexShaderSource:  CustomSensorVolumeVS(),
                  fragmentShaderSource: fsSource,
                  attributeLocations: attributeLocations
                });


                frontFaceColorCommand.uniformMap = Cesium.combine(this._uniforms, this._lateralSurfaceMaterial._uniforms);

                backFaceColorCommand.shaderProgram = frontFaceColorCommand.shaderProgram;
                backFaceColorCommand.uniformMap = Cesium.combine(this._uniforms, this._lateralSurfaceMaterial._uniforms);
                backFaceColorCommand.uniformMap.u_normalDirection = function() {
                    return -1.0;
                };
            }

            if (translucent) {
                options.commandList.push(this._backFaceColorCommand, this._frontFaceColorCommand);
            } else {
                options.commandList.push(this._frontFaceColorCommand);
            }
        }
    };

    /**
     * DOC_TBA
     */
    CustomSensorVolume.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * DOC_TBA
     */
    CustomSensorVolume.prototype.destroy = function() {
        this._frontFaceColorCommand.vertexArray = this._frontFaceColorCommand.vertexArray && this._frontFaceColorCommand.vertexArray.destroy();
        this._frontFaceColorCommand.shaderProgram = this._frontFaceColorCommand.shaderProgram && this._frontFaceColorCommand.shaderProgram.destroy();
    };

})();

export { CustomSensorVolume };
