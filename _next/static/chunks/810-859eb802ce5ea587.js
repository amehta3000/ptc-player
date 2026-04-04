(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[810],{7137:function(e,t,s){"use strict";var r,n;let i;s.d(t,{C:function(){return FFmpeg}}),(n=r||(r={})).LOAD="LOAD",n.EXEC="EXEC",n.WRITE_FILE="WRITE_FILE",n.READ_FILE="READ_FILE",n.DELETE_FILE="DELETE_FILE",n.RENAME="RENAME",n.CREATE_DIR="CREATE_DIR",n.LIST_DIR="LIST_DIR",n.DELETE_DIR="DELETE_DIR",n.ERROR="ERROR",n.DOWNLOAD="DOWNLOAD",n.PROGRESS="PROGRESS",n.LOG="LOG",n.MOUNT="MOUNT",n.UNMOUNT="UNMOUNT";let a=(i=0,()=>i++);Error("unknown message type");let o=Error("ffmpeg is not loaded, call `await ffmpeg.load()` first"),l=Error("called FFmpeg.terminate()");Error("failed to import ffmpeg-core.js");let FFmpeg=class FFmpeg{#e=null;#t={};#s={};#r=[];#n=[];loaded=!1;#i=()=>{this.#e&&(this.#e.onmessage=({data:{id:e,type:t,data:s}})=>{switch(t){case r.LOAD:this.loaded=!0,this.#t[e](s);break;case r.MOUNT:case r.UNMOUNT:case r.EXEC:case r.WRITE_FILE:case r.READ_FILE:case r.DELETE_FILE:case r.RENAME:case r.CREATE_DIR:case r.LIST_DIR:case r.DELETE_DIR:this.#t[e](s);break;case r.LOG:this.#r.forEach(e=>e(s));break;case r.PROGRESS:this.#n.forEach(e=>e(s));break;case r.ERROR:this.#s[e](s)}delete this.#t[e],delete this.#s[e]})};#a=({type:e,data:t},s=[],r)=>this.#e?new Promise((n,i)=>{let o=a();this.#e&&this.#e.postMessage({id:o,type:e,data:t},s),this.#t[o]=n,this.#s[o]=i,r?.addEventListener("abort",()=>{i(new DOMException(`Message # ${o} was aborted`,"AbortError"))},{once:!0})}):Promise.reject(o);on(e,t){"log"===e?this.#r.push(t):"progress"===e&&this.#n.push(t)}off(e,t){"log"===e?this.#r=this.#r.filter(e=>e!==t):"progress"===e&&(this.#n=this.#n.filter(e=>e!==t))}load=({classWorkerURL:e,...t}={},{signal:n}={})=>(this.#e||(this.#e=e?new Worker(new URL(e,"file:///home/runner/work/ptc-player/ptc-player/node_modules/@ffmpeg/ffmpeg/dist/esm/classes.js"),{type:"module"}):new Worker(s.tu(new URL(s.p+s.u(480),s.b)),{type:void 0}),this.#i()),this.#a({type:r.LOAD,data:t},void 0,n));exec=(e,t=-1,{signal:s}={})=>this.#a({type:r.EXEC,data:{args:e,timeout:t}},void 0,s);terminate=()=>{let e=Object.keys(this.#s);for(let t of e)this.#s[t](l),delete this.#s[t],delete this.#t[t];this.#e&&(this.#e.terminate(),this.#e=null,this.loaded=!1)};writeFile=(e,t,{signal:s}={})=>{let n=[];return t instanceof Uint8Array&&n.push(t.buffer),this.#a({type:r.WRITE_FILE,data:{path:e,data:t}},n,s)};mount=(e,t,s)=>this.#a({type:r.MOUNT,data:{fsType:e,options:t,mountPoint:s}},[]);unmount=e=>this.#a({type:r.UNMOUNT,data:{mountPoint:e}},[]);readFile=(e,t="binary",{signal:s}={})=>this.#a({type:r.READ_FILE,data:{path:e,encoding:t}},void 0,s);deleteFile=(e,{signal:t}={})=>this.#a({type:r.DELETE_FILE,data:{path:e}},void 0,t);rename=(e,t,{signal:s}={})=>this.#a({type:r.RENAME,data:{oldPath:e,newPath:t}},void 0,s);createDir=(e,{signal:t}={})=>this.#a({type:r.CREATE_DIR,data:{path:e}},void 0,t);listDir=(e,{signal:t}={})=>this.#a({type:r.LIST_DIR,data:{path:e}},void 0,t);deleteDir=(e,{signal:t}={})=>this.#a({type:r.DELETE_DIR,data:{path:e}},void 0,t)}},1814:function(e,t,s){"use strict";s.d(t,{dc:function(){return fetchFile},Wn:function(){return toBlobURL}});let r=Error("failed to get response body reader"),n=Error("failed to complete download"),readFromBlobOrFile=e=>new Promise((t,s)=>{let r=new FileReader;r.onload=()=>{let{result:e}=r;e instanceof ArrayBuffer?t(new Uint8Array(e)):t(new Uint8Array)},r.onerror=e=>{s(Error(`File could not be read! Code=${e?.target?.error?.code||-1}`))},r.readAsArrayBuffer(e)}),fetchFile=async e=>{let t;if("string"==typeof e)t=/data:_data\/([a-zA-Z]*);base64,([^"]*)/.test(e)?atob(e.split(",")[1]).split("").map(e=>e.charCodeAt(0)):await (await fetch(e)).arrayBuffer();else if(e instanceof URL)t=await (await fetch(e)).arrayBuffer();else{if(!(e instanceof File||e instanceof Blob))return new Uint8Array;t=await readFromBlobOrFile(e)}return new Uint8Array(t)},downloadWithProgress=async(e,t)=>{let s;let i=await fetch(e);try{let a=parseInt(i.headers.get("Content-Length")||"-1"),o=i.body?.getReader();if(!o)throw r;let l=[],c=0;for(;;){let{done:s,value:r}=await o.read(),i=r?r.length:0;if(s){if(-1!=a&&a!==c)throw n;t&&t({url:e,total:a,received:c,delta:i,done:s});break}l.push(r),c+=i,t&&t({url:e,total:a,received:c,delta:i,done:s})}let u=new Uint8Array(c),d=0;for(let e of l)u.set(e,d),d+=e.length;s=u.buffer}catch(r){console.log("failed to send download progress event: ",r),s=await i.arrayBuffer(),t&&t({url:e,total:s.byteLength,received:s.byteLength,delta:0,done:!0})}return s},toBlobURL=async(e,t,s=!1,r)=>{let n=s?await downloadWithProgress(e,r):await (await fetch(e)).arrayBuffer(),i=new Blob([n],{type:t});return URL.createObjectURL(i)}},9008:function(e,t,s){e.exports=s(9201)},4175:function(e,t,s){"use strict";let r,n;s.d(t,{w:function(){return Line2}});var i=s(4250),a=s(8671),o=s(1911);let l=new i.Ltg,c=new i.Pa4,u=new i.Pa4,d=new i.Ltg,h=new i.Ltg,p=new i.Ltg,f=new i.Pa4,m=new i.yGw,g=new i.Zzh,T=new i.Pa4,x=new i.ZzF,E=new i.aLr,v=new i.Ltg;function getWorldSpaceHalfWidth(e,t,s){return v.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),v.multiplyScalar(1/v.w),v.x=n/s.width,v.y=n/s.height,v.applyMatrix4(e.projectionMatrixInverse),v.multiplyScalar(1/v.w),Math.abs(Math.max(v.x,v.y))}function raycastWorldUnits(e,t){let s=e.matrixWorld,a=e.geometry,o=a.attributes.instanceStart,l=a.attributes.instanceEnd,c=Math.min(a.instanceCount,o.count);for(let a=0;a<c;a++){g.start.fromBufferAttribute(o,a),g.end.fromBufferAttribute(l,a),g.applyMatrix4(s);let c=new i.Pa4,u=new i.Pa4;r.distanceSqToSegment(g.start,g.end,u,c);let d=u.distanceTo(c)<.5*n;d&&t.push({point:u,pointOnLine:c,distance:r.origin.distanceTo(u),object:e,face:null,faceIndex:a,uv:null,uv1:null})}}function raycastScreenSpace(e,t,s){let a=t.projectionMatrix,o=e.material,l=o.resolution,c=e.matrixWorld,u=e.geometry,x=u.attributes.instanceStart,E=u.attributes.instanceEnd,v=Math.min(u.instanceCount,x.count),y=-t.near;r.at(1,p),p.w=1,p.applyMatrix4(t.matrixWorldInverse),p.applyMatrix4(a),p.multiplyScalar(1/p.w),p.x*=l.x/2,p.y*=l.y/2,p.z=0,f.copy(p),m.multiplyMatrices(t.matrixWorldInverse,c);for(let t=0;t<v;t++){d.fromBufferAttribute(x,t),h.fromBufferAttribute(E,t),d.w=1,h.w=1,d.applyMatrix4(m),h.applyMatrix4(m);let o=d.z>y&&h.z>y;if(o)continue;if(d.z>y){let e=d.z-h.z,t=(d.z-y)/e;d.lerp(h,t)}else if(h.z>y){let e=h.z-d.z,t=(h.z-y)/e;h.lerp(d,t)}d.applyMatrix4(a),h.applyMatrix4(a),d.multiplyScalar(1/d.w),h.multiplyScalar(1/h.w),d.x*=l.x/2,d.y*=l.y/2,h.x*=l.x/2,h.y*=l.y/2,g.start.copy(d),g.start.z=0,g.end.copy(h),g.end.z=0;let u=g.closestPointToPointParameter(f,!0);g.at(u,T);let p=i.M8C.lerp(d.z,h.z,u),v=p>=-1&&p<=1,w=f.distanceTo(T)<.5*n;if(v&&w){g.start.fromBufferAttribute(x,t),g.end.fromBufferAttribute(E,t),g.start.applyMatrix4(c),g.end.applyMatrix4(c);let n=new i.Pa4,a=new i.Pa4;r.distanceSqToSegment(g.start,g.end,a,n),s.push({point:a,pointOnLine:n,distance:r.origin.distanceTo(a),object:e,face:null,faceIndex:t,uv:null,uv1:null})}}}let LineSegments2=class LineSegments2 extends i.Kj0{constructor(e=new a.z,t=new o.Y({color:16777215*Math.random()})){super(e,t),this.isLineSegments2=!0,this.type="LineSegments2"}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,s=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,n=0,i=t.count;e<i;e++,n+=2)c.fromBufferAttribute(t,e),u.fromBufferAttribute(s,e),r[n]=0===n?0:r[n-1],r[n+1]=r[n]+c.distanceTo(u);let n=new i.$TI(r,2,1);return e.setAttribute("instanceDistanceStart",new i.kB5(n,1,0)),e.setAttribute("instanceDistanceEnd",new i.kB5(n,1,1)),this}raycast(e,t){let s,i;let a=this.material.worldUnits,o=e.camera;null!==o||a||console.error('LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.');let l=void 0!==e.params.Line2&&e.params.Line2.threshold||0;r=e.ray;let c=this.matrixWorld,u=this.geometry,d=this.material;if(n=d.linewidth+l,null===u.boundingSphere&&u.computeBoundingSphere(),E.copy(u.boundingSphere).applyMatrix4(c),a)s=.5*n;else{let e=Math.max(o.near,E.distanceToPoint(r.origin));s=getWorldSpaceHalfWidth(o,e,d.resolution)}if(E.radius+=s,!1!==r.intersectsSphere(E)){if(null===u.boundingBox&&u.computeBoundingBox(),x.copy(u.boundingBox).applyMatrix4(c),a)i=.5*n;else{let e=Math.max(o.near,x.distanceToPoint(r.origin));i=getWorldSpaceHalfWidth(o,e,d.resolution)}x.expandByScalar(i),!1!==r.intersectsBox(x)&&(a?raycastWorldUnits(this,t):raycastScreenSpace(this,o,t))}}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(l),this.material.uniforms.resolution.value.set(l.z,l.w))}};var y=s(9823);let Line2=class Line2 extends LineSegments2{constructor(e=new y.L,t=new o.Y({color:16777215*Math.random()})){super(e,t),this.isLine2=!0,this.type="Line2"}}},9823:function(e,t,s){"use strict";s.d(t,{L:function(){return LineGeometry}});var r=s(8671);let LineGeometry=class LineGeometry extends r.z{constructor(){super(),this.isLineGeometry=!0,this.type="LineGeometry"}setPositions(e){let t=e.length-3,s=new Float32Array(2*t);for(let r=0;r<t;r+=3)s[2*r]=e[r],s[2*r+1]=e[r+1],s[2*r+2]=e[r+2],s[2*r+3]=e[r+3],s[2*r+4]=e[r+4],s[2*r+5]=e[r+5];return super.setPositions(s),this}setColors(e){let t=e.length-3,s=new Float32Array(2*t);for(let r=0;r<t;r+=3)s[2*r]=e[r],s[2*r+1]=e[r+1],s[2*r+2]=e[r+2],s[2*r+3]=e[r+3],s[2*r+4]=e[r+4],s[2*r+5]=e[r+5];return super.setColors(s),this}setFromPoints(e){let t=e.length-1,s=new Float32Array(6*t);for(let r=0;r<t;r++)s[6*r]=e[r].x,s[6*r+1]=e[r].y,s[6*r+2]=e[r].z||0,s[6*r+3]=e[r+1].x,s[6*r+4]=e[r+1].y,s[6*r+5]=e[r+1].z||0;return super.setPositions(s),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}}},1911:function(e,t,s){"use strict";s.d(t,{Y:function(){return LineMaterial}});var r=s(9477),n=s(4250);r.rBU.line={worldUnits:{value:1},linewidth:{value:1},resolution:{value:new n.FM8(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}},r.Vj0.line={uniforms:n.rDY.merge([r.rBU.common,r.rBU.fog,r.rBU.line]),vertexShader:`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		void trimSegment( const in vec4 start, inout vec4 end ) {

			// trim end segment so it terminates between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
			float nearEstimate = - 0.5 * b / a;

			float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

			end.xyz = mix( start.xyz, end.xyz, alpha );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
				vUv = uv;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					trimSegment( start, end );

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					trimSegment( end, start );

				}

			}

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,fragmentShader:`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			float alpha = opacity;
			vec4 diffuseColor = vec4( diffuse, alpha );

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`};let LineMaterial=class LineMaterial extends n.jyz{constructor(e){super({type:"LineMaterial",uniforms:n.rDY.clone(r.Vj0.line.uniforms),vertexShader:r.Vj0.line.vertexShader,fragmentShader:r.Vj0.line.fragmentShader,clipping:!0}),this.isLineMaterial=!0,this.setValues(e)}get color(){return this.uniforms.diffuse.value}set color(e){this.uniforms.diffuse.value=e}get worldUnits(){return"WORLD_UNITS"in this.defines}set worldUnits(e){!0===e?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}get linewidth(){return this.uniforms.linewidth.value}set linewidth(e){this.uniforms.linewidth&&(this.uniforms.linewidth.value=e)}get dashed(){return"USE_DASH"in this.defines}set dashed(e){!0===e!==this.dashed&&(this.needsUpdate=!0),!0===e?this.defines.USE_DASH="":delete this.defines.USE_DASH}get dashScale(){return this.uniforms.dashScale.value}set dashScale(e){this.uniforms.dashScale.value=e}get dashSize(){return this.uniforms.dashSize.value}set dashSize(e){this.uniforms.dashSize.value=e}get dashOffset(){return this.uniforms.dashOffset.value}set dashOffset(e){this.uniforms.dashOffset.value=e}get gapSize(){return this.uniforms.gapSize.value}set gapSize(e){this.uniforms.gapSize.value=e}get opacity(){return this.uniforms.opacity.value}set opacity(e){this.uniforms&&(this.uniforms.opacity.value=e)}get resolution(){return this.uniforms.resolution.value}set resolution(e){this.uniforms.resolution.value.copy(e)}get alphaToCoverage(){return"USE_ALPHA_TO_COVERAGE"in this.defines}set alphaToCoverage(e){this.defines&&(!0===e!==this.alphaToCoverage&&(this.needsUpdate=!0),!0===e?this.defines.USE_ALPHA_TO_COVERAGE="":delete this.defines.USE_ALPHA_TO_COVERAGE)}}},8671:function(e,t,s){"use strict";s.d(t,{z:function(){return LineSegmentsGeometry}});var r=s(4250);let n=new r.ZzF,i=new r.Pa4;let LineSegmentsGeometry=class LineSegmentsGeometry extends r.L5s{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type="LineSegmentsGeometry",this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute("position",new r.a$l([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute("uv",new r.a$l([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,s=this.attributes.instanceEnd;return void 0!==t&&(t.applyMatrix4(e),s.applyMatrix4(e),t.needsUpdate=!0),null!==this.boundingBox&&this.computeBoundingBox(),null!==this.boundingSphere&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let s=new r.$TI(t,6,1);return this.setAttribute("instanceStart",new r.kB5(s,3,0)),this.setAttribute("instanceEnd",new r.kB5(s,3,3)),this.instanceCount=this.attributes.instanceStart.count,this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let s=new r.$TI(t,6,1);return this.setAttribute("instanceColorStart",new r.kB5(s,3,0)),this.setAttribute("instanceColorEnd",new r.kB5(s,3,3)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new r.Uk6(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){null===this.boundingBox&&(this.boundingBox=new r.ZzF);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;void 0!==e&&void 0!==t&&(this.boundingBox.setFromBufferAttribute(e),n.setFromBufferAttribute(t),this.boundingBox.union(n))}computeBoundingSphere(){null===this.boundingSphere&&(this.boundingSphere=new r.aLr),null===this.boundingBox&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(void 0!==e&&void 0!==t){let s=this.boundingSphere.center;this.boundingBox.getCenter(s);let r=0;for(let n=0,a=e.count;n<a;n++)i.fromBufferAttribute(e,n),r=Math.max(r,s.distanceToSquared(i)),i.fromBufferAttribute(t,n),r=Math.max(r,s.distanceToSquared(i));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error("THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.",this)}}toJSON(){}}},7836:function(e,t,s){"use strict";s.d(t,{E:function(){return GLTFLoader}});var r=s(4250);function toTrianglesDrawMode(e,t){if(t===r.WwZ)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),e;if(t!==r.z$h&&t!==r.UlW)return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",t),e;{let s=e.getIndex();if(null===s){let t=[],r=e.getAttribute("position");if(void 0===r)return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),e;for(let e=0;e<r.count;e++)t.push(e);e.setIndex(t),s=e.getIndex()}let n=s.count-2,i=[];if(t===r.z$h)for(let e=1;e<=n;e++)i.push(s.getX(0)),i.push(s.getX(e)),i.push(s.getX(e+1));else for(let e=0;e<n;e++)e%2==0?(i.push(s.getX(e)),i.push(s.getX(e+1)),i.push(s.getX(e+2))):(i.push(s.getX(e+2)),i.push(s.getX(e+1)),i.push(s.getX(e)));i.length/3!==n&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");let a=e.clone();return a.setIndex(i),a.clearGroups(),a}}let GLTFLoader=class GLTFLoader extends r.aNw{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(e){return new GLTFMaterialsClearcoatExtension(e)}),this.register(function(e){return new GLTFMaterialsDispersionExtension(e)}),this.register(function(e){return new GLTFTextureBasisUExtension(e)}),this.register(function(e){return new GLTFTextureWebPExtension(e)}),this.register(function(e){return new GLTFTextureAVIFExtension(e)}),this.register(function(e){return new GLTFMaterialsSheenExtension(e)}),this.register(function(e){return new GLTFMaterialsTransmissionExtension(e)}),this.register(function(e){return new GLTFMaterialsVolumeExtension(e)}),this.register(function(e){return new GLTFMaterialsIorExtension(e)}),this.register(function(e){return new GLTFMaterialsEmissiveStrengthExtension(e)}),this.register(function(e){return new GLTFMaterialsSpecularExtension(e)}),this.register(function(e){return new GLTFMaterialsIridescenceExtension(e)}),this.register(function(e){return new GLTFMaterialsAnisotropyExtension(e)}),this.register(function(e){return new GLTFMaterialsBumpExtension(e)}),this.register(function(e){return new GLTFLightsExtension(e)}),this.register(function(e){return new GLTFMeshoptCompression(e)}),this.register(function(e){return new GLTFMeshGpuInstancing(e)})}load(e,t,s,n){let i;let a=this;if(""!==this.resourcePath)i=this.resourcePath;else if(""!==this.path){let t=r.Zp0.extractUrlBase(e);i=r.Zp0.resolveURL(t,this.path)}else i=r.Zp0.extractUrlBase(e);this.manager.itemStart(e);let _onError=function(t){n?n(t):console.error(t),a.manager.itemError(e),a.manager.itemEnd(e)},o=new r.hH6(this.manager);o.setPath(this.path),o.setResponseType("arraybuffer"),o.setRequestHeader(this.requestHeader),o.setWithCredentials(this.withCredentials),o.load(e,function(s){try{a.parse(s,i,function(s){t(s),a.manager.itemEnd(e)},_onError)}catch(e){_onError(e)}},s,_onError)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return -1===this.pluginCallbacks.indexOf(e)&&this.pluginCallbacks.push(e),this}unregister(e){return -1!==this.pluginCallbacks.indexOf(e)&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,s,r){let a;let o={},l={},c=new TextDecoder;if("string"==typeof e)a=JSON.parse(e);else if(e instanceof ArrayBuffer){let t=c.decode(new Uint8Array(e,0,4));if(t===i){try{o[n.KHR_BINARY_GLTF]=new GLTFBinaryExtension(e)}catch(e){r&&r(e);return}a=JSON.parse(o[n.KHR_BINARY_GLTF].content)}else a=JSON.parse(c.decode(e))}else a=e;if(void 0===a.asset||a.asset.version[0]<2){r&&r(Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}let u=new GLTFParser(a,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});u.fileLoader.setRequestHeader(this.requestHeader);for(let e=0;e<this.pluginCallbacks.length;e++){let t=this.pluginCallbacks[e](u);t.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),l[t.name]=t,o[t.name]=!0}if(a.extensionsUsed)for(let e=0;e<a.extensionsUsed.length;++e){let t=a.extensionsUsed[e],s=a.extensionsRequired||[];switch(t){case n.KHR_MATERIALS_UNLIT:o[t]=new GLTFMaterialsUnlitExtension;break;case n.KHR_DRACO_MESH_COMPRESSION:o[t]=new GLTFDracoMeshCompressionExtension(a,this.dracoLoader);break;case n.KHR_TEXTURE_TRANSFORM:o[t]=new GLTFTextureTransformExtension;break;case n.KHR_MESH_QUANTIZATION:o[t]=new GLTFMeshQuantizationExtension;break;default:s.indexOf(t)>=0&&void 0===l[t]&&console.warn('THREE.GLTFLoader: Unknown extension "'+t+'".')}}u.setExtensions(o),u.setPlugins(l),u.parse(s,r)}parseAsync(e,t){let s=this;return new Promise(function(r,n){s.parse(e,t,r,n)})}};function GLTFRegistry(){let e={};return{get:function(t){return e[t]},add:function(t,s){e[t]=s},remove:function(t){delete e[t]},removeAll:function(){e={}}}}let n={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"};let GLTFLightsExtension=class GLTFLightsExtension{constructor(e){this.parser=e,this.name=n.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){let e=this.parser,t=this.parser.json.nodes||[];for(let s=0,r=t.length;s<r;s++){let r=t[s];r.extensions&&r.extensions[this.name]&&void 0!==r.extensions[this.name].light&&e._addNodeRef(this.cache,r.extensions[this.name].light)}}_loadLight(e){let t;let s=this.parser,n="light:"+e,i=s.cache.get(n);if(i)return i;let a=s.json,o=a.extensions&&a.extensions[this.name]||{},l=o.lights||[],c=l[e],u=new r.Ilk(16777215);void 0!==c.color&&u.setRGB(c.color[0],c.color[1],c.color[2],r.GUF);let d=void 0!==c.range?c.range:0;switch(c.type){case"directional":(t=new r.Ox3(u)).target.position.set(0,0,-1),t.add(t.target);break;case"point":(t=new r.cek(u)).distance=d;break;case"spot":(t=new r.PMe(u)).distance=d,c.spot=c.spot||{},c.spot.innerConeAngle=void 0!==c.spot.innerConeAngle?c.spot.innerConeAngle:0,c.spot.outerConeAngle=void 0!==c.spot.outerConeAngle?c.spot.outerConeAngle:Math.PI/4,t.angle=c.spot.outerConeAngle,t.penumbra=1-c.spot.innerConeAngle/c.spot.outerConeAngle,t.target.position.set(0,0,-1),t.add(t.target);break;default:throw Error("THREE.GLTFLoader: Unexpected light type: "+c.type)}return t.position.set(0,0,0),assignExtrasToUserData(t,c),void 0!==c.intensity&&(t.intensity=c.intensity),t.name=s.createUniqueName(c.name||"light_"+e),i=Promise.resolve(t),s.cache.add(n,i),i}getDependency(e,t){if("light"===e)return this._loadLight(t)}createNodeAttachment(e){let t=this,s=this.parser,r=s.json,n=r.nodes[e],i=n.extensions&&n.extensions[this.name]||{},a=i.light;return void 0===a?null:this._loadLight(a).then(function(e){return s._getNodeRef(t.cache,a,e)})}};let GLTFMaterialsUnlitExtension=class GLTFMaterialsUnlitExtension{constructor(){this.name=n.KHR_MATERIALS_UNLIT}getMaterialType(){return r.vBJ}extendParams(e,t,s){let n=[];e.color=new r.Ilk(1,1,1),e.opacity=1;let i=t.pbrMetallicRoughness;if(i){if(Array.isArray(i.baseColorFactor)){let t=i.baseColorFactor;e.color.setRGB(t[0],t[1],t[2],r.GUF),e.opacity=t[3]}void 0!==i.baseColorTexture&&n.push(s.assignTexture(e,"map",i.baseColorTexture,r.KI_))}return Promise.all(n)}};let GLTFMaterialsEmissiveStrengthExtension=class GLTFMaterialsEmissiveStrengthExtension{constructor(e){this.parser=e,this.name=n.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){let s=this.parser,r=s.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let n=r.extensions[this.name].emissiveStrength;return void 0!==n&&(t.emissiveIntensity=n),Promise.resolve()}};let GLTFMaterialsClearcoatExtension=class GLTFMaterialsClearcoatExtension{constructor(e){this.parser=e,this.name=n.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){let t=this.parser,s=t.json.materials[e];return s.extensions&&s.extensions[this.name]?r.EJi:null}extendMaterialParams(e,t){let s=this.parser,n=s.json.materials[e];if(!n.extensions||!n.extensions[this.name])return Promise.resolve();let i=[],a=n.extensions[this.name];if(void 0!==a.clearcoatFactor&&(t.clearcoat=a.clearcoatFactor),void 0!==a.clearcoatTexture&&i.push(s.assignTexture(t,"clearcoatMap",a.clearcoatTexture)),void 0!==a.clearcoatRoughnessFactor&&(t.clearcoatRoughness=a.clearcoatRoughnessFactor),void 0!==a.clearcoatRoughnessTexture&&i.push(s.assignTexture(t,"clearcoatRoughnessMap",a.clearcoatRoughnessTexture)),void 0!==a.clearcoatNormalTexture&&(i.push(s.assignTexture(t,"clearcoatNormalMap",a.clearcoatNormalTexture)),void 0!==a.clearcoatNormalTexture.scale)){let e=a.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new r.FM8(e,e)}return Promise.all(i)}};let GLTFMaterialsDispersionExtension=class GLTFMaterialsDispersionExtension{constructor(e){this.parser=e,this.name=n.KHR_MATERIALS_DISPERSION}getMaterialType(e){let t=this.parser,s=t.json.materials[e];return s.extensions&&s.extensions[this.name]?r.EJi:null}extendMaterialParams(e,t){let s=this.parser,r=s.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let n=r.extensions[this.name];return t.dispersion=void 0!==n.dispersion?n.dispersion:0,Promise.resolve()}};let GLTFMaterialsIridescenceExtension=class GLTFMaterialsIridescenceExtension{constructor(e){this.parser=e,this.name=n.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){let t=this.parser,s=t.json.materials[e];return s.extensions&&s.extensions[this.name]?r.EJi:null}extendMaterialParams(e,t){let s=this.parser,r=s.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let n=[],i=r.extensions[this.name];return void 0!==i.iridescenceFactor&&(t.iridescence=i.iridescenceFactor),void 0!==i.iridescenceTexture&&n.push(s.assignTexture(t,"iridescenceMap",i.iridescenceTexture)),void 0!==i.iridescenceIor&&(t.iridescenceIOR=i.iridescenceIor),void 0===t.iridescenceThicknessRange&&(t.iridescenceThicknessRange=[100,400]),void 0!==i.iridescenceThicknessMinimum&&(t.iridescenceThicknessRange[0]=i.iridescenceThicknessMinimum),void 0!==i.iridescenceThicknessMaximum&&(t.iridescenceThicknessRange[1]=i.iridescenceThicknessMaximum),void 0!==i.iridescenceThicknessTexture&&n.push(s.assignTexture(t,"iridescenceThicknessMap",i.iridescenceThicknessTexture)),Promise.all(n)}};let GLTFMaterialsSheenExtension=class GLTFMaterialsSheenExtension{constructor(e){this.parser=e,this.name=n.KHR_MATERIALS_SHEEN}getMaterialType(e){let t=this.parser,s=t.json.materials[e];return s.extensions&&s.extensions[this.name]?r.EJi:null}extendMaterialParams(e,t){let s=this.parser,n=s.json.materials[e];if(!n.extensions||!n.extensions[this.name])return Promise.resolve();let i=[];t.sheenColor=new r.Ilk(0,0,0),t.sheenRoughness=0,t.sheen=1;let a=n.extensions[this.name];if(void 0!==a.sheenColorFactor){let e=a.sheenColorFactor;t.sheenColor.setRGB(e[0],e[1],e[2],r.GUF)}return void 0!==a.sheenRoughnessFactor&&(t.sheenRoughness=a.sheenRoughnessFactor),void 0!==a.sheenColorTexture&&i.push(s.assignTexture(t,"sheenColorMap",a.sheenColorTexture,r.KI_)),void 0!==a.sheenRoughnessTexture&&i.push(s.assignTexture(t,"sheenRoughnessMap",a.sheenRoughnessTexture)),Promise.all(i)}};let GLTFMaterialsTransmissionExtension=class GLTFMaterialsTransmissionExtension{constructor(e){this.parser=e,this.name=n.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){let t=this.parser,s=t.json.materials[e];return s.extensions&&s.extensions[this.name]?r.EJi:null}extendMaterialParams(e,t){let s=this.parser,r=s.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let n=[],i=r.extensions[this.name];return void 0!==i.transmissionFactor&&(t.transmission=i.transmissionFactor),void 0!==i.transmissionTexture&&n.push(s.assignTexture(t,"transmissionMap",i.transmissionTexture)),Promise.all(n)}};let GLTFMaterialsVolumeExtension=class GLTFMaterialsVolumeExtension{constructor(e){this.parser=e,this.name=n.KHR_MATERIALS_VOLUME}getMaterialType(e){let t=this.parser,s=t.json.materials[e];return s.extensions&&s.extensions[this.name]?r.EJi:null}extendMaterialParams(e,t){let s=this.parser,n=s.json.materials[e];if(!n.extensions||!n.extensions[this.name])return Promise.resolve();let i=[],a=n.extensions[this.name];t.thickness=void 0!==a.thicknessFactor?a.thicknessFactor:0,void 0!==a.thicknessTexture&&i.push(s.assignTexture(t,"thicknessMap",a.thicknessTexture)),t.attenuationDistance=a.attenuationDistance||1/0;let o=a.attenuationColor||[1,1,1];return t.attenuationColor=new r.Ilk().setRGB(o[0],o[1],o[2],r.GUF),Promise.all(i)}};let GLTFMaterialsIorExtension=class GLTFMaterialsIorExtension{constructor(e){this.parser=e,this.name=n.KHR_MATERIALS_IOR}getMaterialType(e){let t=this.parser,s=t.json.materials[e];return s.extensions&&s.extensions[this.name]?r.EJi:null}extendMaterialParams(e,t){let s=this.parser,r=s.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let n=r.extensions[this.name];return t.ior=void 0!==n.ior?n.ior:1.5,Promise.resolve()}};let GLTFMaterialsSpecularExtension=class GLTFMaterialsSpecularExtension{constructor(e){this.parser=e,this.name=n.KHR_MATERIALS_SPECULAR}getMaterialType(e){let t=this.parser,s=t.json.materials[e];return s.extensions&&s.extensions[this.name]?r.EJi:null}extendMaterialParams(e,t){let s=this.parser,n=s.json.materials[e];if(!n.extensions||!n.extensions[this.name])return Promise.resolve();let i=[],a=n.extensions[this.name];t.specularIntensity=void 0!==a.specularFactor?a.specularFactor:1,void 0!==a.specularTexture&&i.push(s.assignTexture(t,"specularIntensityMap",a.specularTexture));let o=a.specularColorFactor||[1,1,1];return t.specularColor=new r.Ilk().setRGB(o[0],o[1],o[2],r.GUF),void 0!==a.specularColorTexture&&i.push(s.assignTexture(t,"specularColorMap",a.specularColorTexture,r.KI_)),Promise.all(i)}};let GLTFMaterialsBumpExtension=class GLTFMaterialsBumpExtension{constructor(e){this.parser=e,this.name=n.EXT_MATERIALS_BUMP}getMaterialType(e){let t=this.parser,s=t.json.materials[e];return s.extensions&&s.extensions[this.name]?r.EJi:null}extendMaterialParams(e,t){let s=this.parser,r=s.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let n=[],i=r.extensions[this.name];return t.bumpScale=void 0!==i.bumpFactor?i.bumpFactor:1,void 0!==i.bumpTexture&&n.push(s.assignTexture(t,"bumpMap",i.bumpTexture)),Promise.all(n)}};let GLTFMaterialsAnisotropyExtension=class GLTFMaterialsAnisotropyExtension{constructor(e){this.parser=e,this.name=n.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){let t=this.parser,s=t.json.materials[e];return s.extensions&&s.extensions[this.name]?r.EJi:null}extendMaterialParams(e,t){let s=this.parser,r=s.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let n=[],i=r.extensions[this.name];return void 0!==i.anisotropyStrength&&(t.anisotropy=i.anisotropyStrength),void 0!==i.anisotropyRotation&&(t.anisotropyRotation=i.anisotropyRotation),void 0!==i.anisotropyTexture&&n.push(s.assignTexture(t,"anisotropyMap",i.anisotropyTexture)),Promise.all(n)}};let GLTFTextureBasisUExtension=class GLTFTextureBasisUExtension{constructor(e){this.parser=e,this.name=n.KHR_TEXTURE_BASISU}loadTexture(e){let t=this.parser,s=t.json,r=s.textures[e];if(!r.extensions||!r.extensions[this.name])return null;let n=r.extensions[this.name],i=t.options.ktx2Loader;if(!i){if(!(s.extensionsRequired&&s.extensionsRequired.indexOf(this.name)>=0))return null;throw Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures")}return t.loadTextureImage(e,n.source,i)}};let GLTFTextureWebPExtension=class GLTFTextureWebPExtension{constructor(e){this.parser=e,this.name=n.EXT_TEXTURE_WEBP}loadTexture(e){let t=this.name,s=this.parser,r=s.json,n=r.textures[e];if(!n.extensions||!n.extensions[t])return null;let i=n.extensions[t],a=r.images[i.source],o=s.textureLoader;if(a.uri){let e=s.options.manager.getHandler(a.uri);null!==e&&(o=e)}return s.loadTextureImage(e,i.source,o)}};let GLTFTextureAVIFExtension=class GLTFTextureAVIFExtension{constructor(e){this.parser=e,this.name=n.EXT_TEXTURE_AVIF}loadTexture(e){let t=this.name,s=this.parser,r=s.json,n=r.textures[e];if(!n.extensions||!n.extensions[t])return null;let i=n.extensions[t],a=r.images[i.source],o=s.textureLoader;if(a.uri){let e=s.options.manager.getHandler(a.uri);null!==e&&(o=e)}return s.loadTextureImage(e,i.source,o)}};let GLTFMeshoptCompression=class GLTFMeshoptCompression{constructor(e){this.name=n.EXT_MESHOPT_COMPRESSION,this.parser=e}loadBufferView(e){let t=this.parser.json,s=t.bufferViews[e];if(!s.extensions||!s.extensions[this.name])return null;{let e=s.extensions[this.name],r=this.parser.getDependency("buffer",e.buffer),n=this.parser.options.meshoptDecoder;if(!n||!n.supported){if(!(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0))return null;throw Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files")}return r.then(function(t){let s=e.byteOffset||0,r=e.byteLength||0,i=e.count,a=e.byteStride,o=new Uint8Array(t,s,r);return n.decodeGltfBufferAsync?n.decodeGltfBufferAsync(i,a,o,e.mode,e.filter).then(function(e){return e.buffer}):n.ready.then(function(){let t=new ArrayBuffer(i*a);return n.decodeGltfBuffer(new Uint8Array(t),i,a,o,e.mode,e.filter),t})})}}};let GLTFMeshGpuInstancing=class GLTFMeshGpuInstancing{constructor(e){this.name=n.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){let t=this.parser.json,s=t.nodes[e];if(!s.extensions||!s.extensions[this.name]||void 0===s.mesh)return null;let n=t.meshes[s.mesh];for(let e of n.primitives)if(e.mode!==l.TRIANGLES&&e.mode!==l.TRIANGLE_STRIP&&e.mode!==l.TRIANGLE_FAN&&void 0!==e.mode)return null;let i=s.extensions[this.name],a=i.attributes,o=[],c={};for(let e in a)o.push(this.parser.getDependency("accessor",a[e]).then(t=>(c[e]=t,c[e])));return o.length<1?null:(o.push(this.parser.createNodeMesh(e)),Promise.all(o).then(e=>{let t=e.pop(),s=t.isGroup?t.children:[t],n=e[0].count,i=[];for(let e of s){let t=new r.yGw,s=new r.Pa4,a=new r._fP,o=new r.Pa4(1,1,1),l=new r.SPe(e.geometry,e.material,n);for(let e=0;e<n;e++)c.TRANSLATION&&s.fromBufferAttribute(c.TRANSLATION,e),c.ROTATION&&a.fromBufferAttribute(c.ROTATION,e),c.SCALE&&o.fromBufferAttribute(c.SCALE,e),l.setMatrixAt(e,t.compose(s,a,o));for(let t in c)if("_COLOR_0"===t){let e=c[t];l.instanceColor=new r.lb7(e.array,e.itemSize,e.normalized)}else"TRANSLATION"!==t&&"ROTATION"!==t&&"SCALE"!==t&&e.geometry.setAttribute(t,c[t]);r.Tme.prototype.copy.call(l,e),this.parser.assignFinalMaterial(l),i.push(l)}return t.isGroup?(t.clear(),t.add(...i),t):i[0]}))}};let i="glTF",a={JSON:1313821514,BIN:5130562};let GLTFBinaryExtension=class GLTFBinaryExtension{constructor(e){this.name=n.KHR_BINARY_GLTF,this.content=null,this.body=null;let t=new DataView(e,0,12),s=new TextDecoder;if(this.header={magic:s.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==i)throw Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw Error("THREE.GLTFLoader: Legacy binary file detected.");let r=this.header.length-12,o=new DataView(e,12),l=0;for(;l<r;){let t=o.getUint32(l,!0);l+=4;let r=o.getUint32(l,!0);if(l+=4,r===a.JSON){let r=new Uint8Array(e,12+l,t);this.content=s.decode(r)}else if(r===a.BIN){let s=12+l;this.body=e.slice(s,s+t)}l+=t}if(null===this.content)throw Error("THREE.GLTFLoader: JSON content not found.")}};let GLTFDracoMeshCompressionExtension=class GLTFDracoMeshCompressionExtension{constructor(e,t){if(!t)throw Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=n.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){let s=this.json,n=this.dracoLoader,i=e.extensions[this.name].bufferView,a=e.extensions[this.name].attributes,o={},l={},u={};for(let e in a){let t=p[e]||e.toLowerCase();o[t]=a[e]}for(let t in e.attributes){let r=p[t]||t.toLowerCase();if(void 0!==a[t]){let n=s.accessors[e.attributes[t]],i=c[n.componentType];u[r]=i.name,l[r]=!0===n.normalized}}return t.getDependency("bufferView",i).then(function(e){return new Promise(function(t,s){n.decodeDracoFile(e,function(e){for(let t in e.attributes){let s=e.attributes[t],r=l[t];void 0!==r&&(s.normalized=r)}t(e)},o,u,r.GUF,s)})})}};let GLTFTextureTransformExtension=class GLTFTextureTransformExtension{constructor(){this.name=n.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){return(void 0===t.texCoord||t.texCoord===e.channel)&&void 0===t.offset&&void 0===t.rotation&&void 0===t.scale||(e=e.clone(),void 0!==t.texCoord&&(e.channel=t.texCoord),void 0!==t.offset&&e.offset.fromArray(t.offset),void 0!==t.rotation&&(e.rotation=t.rotation),void 0!==t.scale&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}};let GLTFMeshQuantizationExtension=class GLTFMeshQuantizationExtension{constructor(){this.name=n.KHR_MESH_QUANTIZATION}};let GLTFCubicSplineInterpolant=class GLTFCubicSplineInterpolant extends r._C8{constructor(e,t,s,r){super(e,t,s,r)}copySampleValue_(e){let t=this.resultBuffer,s=this.sampleValues,r=this.valueSize,n=e*r*3+r;for(let e=0;e!==r;e++)t[e]=s[n+e];return t}interpolate_(e,t,s,r){let n=this.resultBuffer,i=this.sampleValues,a=this.valueSize,o=2*a,l=3*a,c=r-t,u=(s-t)/c,d=u*u,h=d*u,p=e*l,f=p-l,m=-2*h+3*d,g=h-d,T=1-m,x=g-d+u;for(let e=0;e!==a;e++){let t=i[f+e+a],s=i[f+e+o]*c,r=i[p+e+a],l=i[p+e]*c;n[e]=T*t+x*s+m*r+g*l}return n}};let o=new r._fP;let GLTFCubicSplineQuaternionInterpolant=class GLTFCubicSplineQuaternionInterpolant extends GLTFCubicSplineInterpolant{interpolate_(e,t,s,r){let n=super.interpolate_(e,t,s,r);return o.fromArray(n).normalize().toArray(n),n}};let l={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},c={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},u={9728:r.TyD,9729:r.wem,9984:r.YLQ,9985:r.qyh,9986:r.aH4,9987:r.D1R},d={33071:r.uWy,33648:r.OoA,10497:r.rpg},h={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},p={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},f={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},m={CUBICSPLINE:void 0,LINEAR:r.NMF,STEP:r.Syv},g={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function createDefaultMaterial(e){return void 0===e.DefaultMaterial&&(e.DefaultMaterial=new r.Wid({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:r.Wl3})),e.DefaultMaterial}function addUnknownExtensionsToUserData(e,t,s){for(let r in s.extensions)void 0===e[r]&&(t.userData.gltfExtensions=t.userData.gltfExtensions||{},t.userData.gltfExtensions[r]=s.extensions[r])}function assignExtrasToUserData(e,t){void 0!==t.extras&&("object"==typeof t.extras?Object.assign(e.userData,t.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+t.extras))}function addMorphTargets(e,t,s){let r=!1,n=!1,i=!1;for(let e=0,s=t.length;e<s;e++){let s=t[e];if(void 0!==s.POSITION&&(r=!0),void 0!==s.NORMAL&&(n=!0),void 0!==s.COLOR_0&&(i=!0),r&&n&&i)break}if(!r&&!n&&!i)return Promise.resolve(e);let a=[],o=[],l=[];for(let c=0,u=t.length;c<u;c++){let u=t[c];if(r){let t=void 0!==u.POSITION?s.getDependency("accessor",u.POSITION):e.attributes.position;a.push(t)}if(n){let t=void 0!==u.NORMAL?s.getDependency("accessor",u.NORMAL):e.attributes.normal;o.push(t)}if(i){let t=void 0!==u.COLOR_0?s.getDependency("accessor",u.COLOR_0):e.attributes.color;l.push(t)}}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l)]).then(function(t){let s=t[0],a=t[1],o=t[2];return r&&(e.morphAttributes.position=s),n&&(e.morphAttributes.normal=a),i&&(e.morphAttributes.color=o),e.morphTargetsRelative=!0,e})}function updateMorphTargets(e,t){if(e.updateMorphTargets(),void 0!==t.weights)for(let s=0,r=t.weights.length;s<r;s++)e.morphTargetInfluences[s]=t.weights[s];if(t.extras&&Array.isArray(t.extras.targetNames)){let s=t.extras.targetNames;if(e.morphTargetInfluences.length===s.length){e.morphTargetDictionary={};for(let t=0,r=s.length;t<r;t++)e.morphTargetDictionary[s[t]]=t}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function createPrimitiveKey(e){let t;let s=e.extensions&&e.extensions[n.KHR_DRACO_MESH_COMPRESSION];if(t=s?"draco:"+s.bufferView+":"+s.indices+":"+createAttributesKey(s.attributes):e.indices+":"+createAttributesKey(e.attributes)+":"+e.mode,void 0!==e.targets)for(let s=0,r=e.targets.length;s<r;s++)t+=":"+createAttributesKey(e.targets[s]);return t}function createAttributesKey(e){let t="",s=Object.keys(e).sort();for(let r=0,n=s.length;r<n;r++)t+=s[r]+":"+e[s[r]]+";";return t}function getNormalizedComponentScale(e){switch(e){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function getImageURIMimeType(e){return e.search(/\.jpe?g($|\?)/i)>0||0===e.search(/^data\:image\/jpeg/)?"image/jpeg":e.search(/\.webp($|\?)/i)>0||0===e.search(/^data\:image\/webp/)?"image/webp":e.search(/\.ktx2($|\?)/i)>0||0===e.search(/^data\:image\/ktx2/)?"image/ktx2":"image/png"}let T=new r.yGw;let GLTFParser=class GLTFParser{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new GLTFRegistry,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let s=!1,n=-1,i=!1,a=-1;if("undefined"!=typeof navigator){let e=navigator.userAgent;s=!0===/^((?!chrome|android).)*safari/i.test(e);let t=e.match(/Version\/(\d+)/);n=s&&t?parseInt(t[1],10):-1,a=(i=e.indexOf("Firefox")>-1)?e.match(/Firefox\/([0-9]+)\./)[1]:-1}"undefined"==typeof createImageBitmap||s&&n<17||i&&a<98?this.textureLoader=new r.dpR(this.options.manager):this.textureLoader=new r.QRU(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new r.hH6(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),"use-credentials"===this.options.crossOrigin&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){let s=this,r=this.json,n=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(e){return e._markDefs&&e._markDefs()}),Promise.all(this._invokeAll(function(e){return e.beforeRoot&&e.beforeRoot()})).then(function(){return Promise.all([s.getDependencies("scene"),s.getDependencies("animation"),s.getDependencies("camera")])}).then(function(t){let i={scene:t[0][r.scene||0],scenes:t[0],animations:t[1],cameras:t[2],asset:r.asset,parser:s,userData:{}};return addUnknownExtensionsToUserData(n,i,r),assignExtrasToUserData(i,r),Promise.all(s._invokeAll(function(e){return e.afterRoot&&e.afterRoot(i)})).then(function(){for(let e of i.scenes)e.updateMatrixWorld();e(i)})}).catch(t)}_markDefs(){let e=this.json.nodes||[],t=this.json.skins||[],s=this.json.meshes||[];for(let s=0,r=t.length;s<r;s++){let r=t[s].joints;for(let t=0,s=r.length;t<s;t++)e[r[t]].isBone=!0}for(let t=0,r=e.length;t<r;t++){let r=e[t];void 0!==r.mesh&&(this._addNodeRef(this.meshCache,r.mesh),void 0!==r.skin&&(s[r.mesh].isSkinnedMesh=!0)),void 0!==r.camera&&this._addNodeRef(this.cameraCache,r.camera)}}_addNodeRef(e,t){void 0!==t&&(void 0===e.refs[t]&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,s){if(e.refs[t]<=1)return s;let r=s.clone(),updateMappings=(e,t)=>{let s=this.associations.get(e);for(let[r,n]of(null!=s&&this.associations.set(t,s),e.children.entries()))updateMappings(n,t.children[r])};return updateMappings(s,r),r.name+="_instance_"+e.uses[t]++,r}_invokeOne(e){let t=Object.values(this.plugins);t.push(this);for(let s=0;s<t.length;s++){let r=e(t[s]);if(r)return r}return null}_invokeAll(e){let t=Object.values(this.plugins);t.unshift(this);let s=[];for(let r=0;r<t.length;r++){let n=e(t[r]);n&&s.push(n)}return s}getDependency(e,t){let s=e+":"+t,r=this.cache.get(s);if(!r){switch(e){case"scene":r=this.loadScene(t);break;case"node":r=this._invokeOne(function(e){return e.loadNode&&e.loadNode(t)});break;case"mesh":r=this._invokeOne(function(e){return e.loadMesh&&e.loadMesh(t)});break;case"accessor":r=this.loadAccessor(t);break;case"bufferView":r=this._invokeOne(function(e){return e.loadBufferView&&e.loadBufferView(t)});break;case"buffer":r=this.loadBuffer(t);break;case"material":r=this._invokeOne(function(e){return e.loadMaterial&&e.loadMaterial(t)});break;case"texture":r=this._invokeOne(function(e){return e.loadTexture&&e.loadTexture(t)});break;case"skin":r=this.loadSkin(t);break;case"animation":r=this._invokeOne(function(e){return e.loadAnimation&&e.loadAnimation(t)});break;case"camera":r=this.loadCamera(t);break;default:if(!(r=this._invokeOne(function(s){return s!=this&&s.getDependency&&s.getDependency(e,t)})))throw Error("Unknown type: "+e)}this.cache.add(s,r)}return r}getDependencies(e){let t=this.cache.get(e);if(!t){let s=this,r=this.json[e+("mesh"===e?"es":"s")]||[];t=Promise.all(r.map(function(t,r){return s.getDependency(e,r)})),this.cache.add(e,t)}return t}loadBuffer(e){let t=this.json.buffers[e],s=this.fileLoader;if(t.type&&"arraybuffer"!==t.type)throw Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(void 0===t.uri&&0===e)return Promise.resolve(this.extensions[n.KHR_BINARY_GLTF].body);let i=this.options;return new Promise(function(e,n){s.load(r.Zp0.resolveURL(t.uri,i.path),e,void 0,function(){n(Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){let t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(e){let s=t.byteLength||0,r=t.byteOffset||0;return e.slice(r,r+s)})}loadAccessor(e){let t=this,s=this.json,n=this.json.accessors[e];if(void 0===n.bufferView&&void 0===n.sparse){let e=h[n.type],t=c[n.componentType],s=!0===n.normalized,i=new t(n.count*e);return Promise.resolve(new r.TlE(i,e,s))}let i=[];return void 0!==n.bufferView?i.push(this.getDependency("bufferView",n.bufferView)):i.push(null),void 0!==n.sparse&&(i.push(this.getDependency("bufferView",n.sparse.indices.bufferView)),i.push(this.getDependency("bufferView",n.sparse.values.bufferView))),Promise.all(i).then(function(e){let i,a;let o=e[0],l=h[n.type],u=c[n.componentType],d=u.BYTES_PER_ELEMENT,p=d*l,f=n.byteOffset||0,m=void 0!==n.bufferView?s.bufferViews[n.bufferView].byteStride:void 0,g=!0===n.normalized;if(m&&m!==p){let e=Math.floor(f/m),s="InterleavedBuffer:"+n.bufferView+":"+n.componentType+":"+e+":"+n.count,c=t.cache.get(s);c||(i=new u(o,e*m,n.count*m/d),c=new r.vpT(i,m/d),t.cache.add(s,c)),a=new r.kB5(c,l,f%m/d,g)}else i=null===o?new u(n.count*l):new u(o,f,n.count*l),a=new r.TlE(i,l,g);if(void 0!==n.sparse){let t=h.SCALAR,s=c[n.sparse.indices.componentType],i=n.sparse.indices.byteOffset||0,d=n.sparse.values.byteOffset||0,p=new s(e[1],i,n.sparse.count*t),f=new u(e[2],d,n.sparse.count*l);null!==o&&(a=new r.TlE(a.array.slice(),a.itemSize,a.normalized)),a.normalized=!1;for(let e=0,t=p.length;e<t;e++){let t=p[e];if(a.setX(t,f[e*l]),l>=2&&a.setY(t,f[e*l+1]),l>=3&&a.setZ(t,f[e*l+2]),l>=4&&a.setW(t,f[e*l+3]),l>=5)throw Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}a.normalized=g}return a})}loadTexture(e){let t=this.json,s=this.options,r=t.textures[e],n=r.source,i=t.images[n],a=this.textureLoader;if(i.uri){let e=s.manager.getHandler(i.uri);null!==e&&(a=e)}return this.loadTextureImage(e,n,a)}loadTextureImage(e,t,s){let n=this,i=this.json,a=i.textures[e],o=i.images[t],l=(o.uri||o.bufferView)+":"+a.sampler;if(this.textureCache[l])return this.textureCache[l];let c=this.loadImageSource(t,s).then(function(t){t.flipY=!1,t.name=a.name||o.name||"",""===t.name&&"string"==typeof o.uri&&!1===o.uri.startsWith("data:image/")&&(t.name=o.uri);let s=i.samplers||{},l=s[a.sampler]||{};return t.magFilter=u[l.magFilter]||r.wem,t.minFilter=u[l.minFilter]||r.D1R,t.wrapS=d[l.wrapS]||r.rpg,t.wrapT=d[l.wrapT]||r.rpg,t.generateMipmaps=!t.isCompressedTexture&&t.minFilter!==r.TyD&&t.minFilter!==r.wem,n.associations.set(t,{textures:e}),t}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){let s=this.json,n=this.options;if(void 0!==this.sourceCache[e])return this.sourceCache[e].then(e=>e.clone());let i=s.images[e],a=self.URL||self.webkitURL,o=i.uri||"",l=!1;if(void 0!==i.bufferView)o=this.getDependency("bufferView",i.bufferView).then(function(e){l=!0;let t=new Blob([e],{type:i.mimeType});return o=a.createObjectURL(t)});else if(void 0===i.uri)throw Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");let c=Promise.resolve(o).then(function(e){return new Promise(function(s,i){let a=s;!0===t.isImageBitmapLoader&&(a=function(e){let t=new r.xEZ(e);t.needsUpdate=!0,s(t)}),t.load(r.Zp0.resolveURL(e,n.path),a,void 0,i)})}).then(function(e){return!0===l&&a.revokeObjectURL(o),assignExtrasToUserData(e,i),e.userData.mimeType=i.mimeType||getImageURIMimeType(i.uri),e}).catch(function(e){throw console.error("THREE.GLTFLoader: Couldn't load texture",o),e});return this.sourceCache[e]=c,c}assignTexture(e,t,s,r){let i=this;return this.getDependency("texture",s.index).then(function(a){if(!a)return null;if(void 0!==s.texCoord&&s.texCoord>0&&((a=a.clone()).channel=s.texCoord),i.extensions[n.KHR_TEXTURE_TRANSFORM]){let e=void 0!==s.extensions?s.extensions[n.KHR_TEXTURE_TRANSFORM]:void 0;if(e){let t=i.associations.get(a);a=i.extensions[n.KHR_TEXTURE_TRANSFORM].extendTexture(a,e),i.associations.set(a,t)}}return void 0!==r&&(a.colorSpace=r),e[t]=a,a})}assignFinalMaterial(e){let t=e.geometry,s=e.material,n=void 0===t.attributes.tangent,i=void 0!==t.attributes.color,a=void 0===t.attributes.normal;if(e.isPoints){let e="PointsMaterial:"+s.uuid,t=this.cache.get(e);t||(t=new r.UY4,r.F5T.prototype.copy.call(t,s),t.color.copy(s.color),t.map=s.map,t.sizeAttenuation=!1,this.cache.add(e,t)),s=t}else if(e.isLine){let e="LineBasicMaterial:"+s.uuid,t=this.cache.get(e);t||(t=new r.nls,r.F5T.prototype.copy.call(t,s),t.color.copy(s.color),t.map=s.map,this.cache.add(e,t)),s=t}if(n||i||a){let e="ClonedMaterial:"+s.uuid+":";n&&(e+="derivative-tangents:"),i&&(e+="vertex-colors:"),a&&(e+="flat-shading:");let t=this.cache.get(e);t||(t=s.clone(),i&&(t.vertexColors=!0),a&&(t.flatShading=!0),n&&(t.normalScale&&(t.normalScale.y*=-1),t.clearcoatNormalScale&&(t.clearcoatNormalScale.y*=-1)),this.cache.add(e,t),this.associations.set(t,this.associations.get(s))),s=t}e.material=s}getMaterialType(){return r.Wid}loadMaterial(e){let t;let s=this,i=this.json,a=this.extensions,o=i.materials[e],l={},c=o.extensions||{},u=[];if(c[n.KHR_MATERIALS_UNLIT]){let e=a[n.KHR_MATERIALS_UNLIT];t=e.getMaterialType(),u.push(e.extendParams(l,o,s))}else{let n=o.pbrMetallicRoughness||{};if(l.color=new r.Ilk(1,1,1),l.opacity=1,Array.isArray(n.baseColorFactor)){let e=n.baseColorFactor;l.color.setRGB(e[0],e[1],e[2],r.GUF),l.opacity=e[3]}void 0!==n.baseColorTexture&&u.push(s.assignTexture(l,"map",n.baseColorTexture,r.KI_)),l.metalness=void 0!==n.metallicFactor?n.metallicFactor:1,l.roughness=void 0!==n.roughnessFactor?n.roughnessFactor:1,void 0!==n.metallicRoughnessTexture&&(u.push(s.assignTexture(l,"metalnessMap",n.metallicRoughnessTexture)),u.push(s.assignTexture(l,"roughnessMap",n.metallicRoughnessTexture))),t=this._invokeOne(function(t){return t.getMaterialType&&t.getMaterialType(e)}),u.push(Promise.all(this._invokeAll(function(t){return t.extendMaterialParams&&t.extendMaterialParams(e,l)})))}!0===o.doubleSided&&(l.side=r.ehD);let d=o.alphaMode||g.OPAQUE;if(d===g.BLEND?(l.transparent=!0,l.depthWrite=!1):(l.transparent=!1,d===g.MASK&&(l.alphaTest=void 0!==o.alphaCutoff?o.alphaCutoff:.5)),void 0!==o.normalTexture&&t!==r.vBJ&&(u.push(s.assignTexture(l,"normalMap",o.normalTexture)),l.normalScale=new r.FM8(1,1),void 0!==o.normalTexture.scale)){let e=o.normalTexture.scale;l.normalScale.set(e,e)}if(void 0!==o.occlusionTexture&&t!==r.vBJ&&(u.push(s.assignTexture(l,"aoMap",o.occlusionTexture)),void 0!==o.occlusionTexture.strength&&(l.aoMapIntensity=o.occlusionTexture.strength)),void 0!==o.emissiveFactor&&t!==r.vBJ){let e=o.emissiveFactor;l.emissive=new r.Ilk().setRGB(e[0],e[1],e[2],r.GUF)}return void 0!==o.emissiveTexture&&t!==r.vBJ&&u.push(s.assignTexture(l,"emissiveMap",o.emissiveTexture,r.KI_)),Promise.all(u).then(function(){let r=new t(l);return o.name&&(r.name=o.name),assignExtrasToUserData(r,o),s.associations.set(r,{materials:e}),o.extensions&&addUnknownExtensionsToUserData(a,r,o),r})}createUniqueName(e){let t=r.iUV.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){let t=this,s=this.extensions,i=this.primitiveCache;function createDracoPrimitive(e){return s[n.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(e,t).then(function(s){return addPrimitiveAttributes(s,e,t)})}let a=[];for(let s=0,o=e.length;s<o;s++){let o=e[s],l=createPrimitiveKey(o),c=i[l];if(c)a.push(c.promise);else{let e;e=o.extensions&&o.extensions[n.KHR_DRACO_MESH_COMPRESSION]?createDracoPrimitive(o):addPrimitiveAttributes(new r.u9r,o,t),i[l]={primitive:o,promise:e},a.push(e)}}return Promise.all(a)}loadMesh(e){let t=this,s=this.json,n=this.extensions,i=s.meshes[e],a=i.primitives,o=[];for(let e=0,t=a.length;e<t;e++){let t=void 0===a[e].material?createDefaultMaterial(this.cache):this.getDependency("material",a[e].material);o.push(t)}return o.push(t.loadGeometries(a)),Promise.all(o).then(function(s){let o=s.slice(0,s.length-1),c=s[s.length-1],u=[];for(let s=0,d=c.length;s<d;s++){let d;let h=c[s],p=a[s],f=o[s];if(p.mode===l.TRIANGLES||p.mode===l.TRIANGLE_STRIP||p.mode===l.TRIANGLE_FAN||void 0===p.mode)!0===(d=!0===i.isSkinnedMesh?new r.TUv(h,f):new r.Kj0(h,f)).isSkinnedMesh&&d.normalizeSkinWeights(),p.mode===l.TRIANGLE_STRIP?d.geometry=toTrianglesDrawMode(d.geometry,r.UlW):p.mode===l.TRIANGLE_FAN&&(d.geometry=toTrianglesDrawMode(d.geometry,r.z$h));else if(p.mode===l.LINES)d=new r.ejS(h,f);else if(p.mode===l.LINE_STRIP)d=new r.x12(h,f);else if(p.mode===l.LINE_LOOP)d=new r.blk(h,f);else if(p.mode===l.POINTS)d=new r.woe(h,f);else throw Error("THREE.GLTFLoader: Primitive mode unsupported: "+p.mode);Object.keys(d.geometry.morphAttributes).length>0&&updateMorphTargets(d,i),d.name=t.createUniqueName(i.name||"mesh_"+e),assignExtrasToUserData(d,i),p.extensions&&addUnknownExtensionsToUserData(n,d,p),t.assignFinalMaterial(d),u.push(d)}for(let s=0,r=u.length;s<r;s++)t.associations.set(u[s],{meshes:e,primitives:s});if(1===u.length)return i.extensions&&addUnknownExtensionsToUserData(n,u[0],i),u[0];let d=new r.ZAu;i.extensions&&addUnknownExtensionsToUserData(n,d,i),t.associations.set(d,{meshes:e});for(let e=0,t=u.length;e<t;e++)d.add(u[e]);return d})}loadCamera(e){let t;let s=this.json.cameras[e],n=s[s.type];if(!n){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return"perspective"===s.type?t=new r.cPb(r.M8C.radToDeg(n.yfov),n.aspectRatio||1,n.znear||1,n.zfar||2e6):"orthographic"===s.type&&(t=new r.iKG(-n.xmag,n.xmag,n.ymag,-n.ymag,n.znear,n.zfar)),s.name&&(t.name=this.createUniqueName(s.name)),assignExtrasToUserData(t,s),Promise.resolve(t)}loadSkin(e){let t=this.json.skins[e],s=[];for(let e=0,r=t.joints.length;e<r;e++)s.push(this._loadNodeShallow(t.joints[e]));return void 0!==t.inverseBindMatrices?s.push(this.getDependency("accessor",t.inverseBindMatrices)):s.push(null),Promise.all(s).then(function(e){let s=e.pop(),n=[],i=[];for(let a=0,o=e.length;a<o;a++){let o=e[a];if(o){n.push(o);let e=new r.yGw;null!==s&&e.fromArray(s.array,16*a),i.push(e)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[a])}return new r.OdW(n,i)})}loadAnimation(e){let t=this.json,s=this,n=t.animations[e],i=n.name?n.name:"animation_"+e,a=[],o=[],l=[],c=[],u=[];for(let e=0,t=n.channels.length;e<t;e++){let t=n.channels[e],s=n.samplers[t.sampler],r=t.target,i=r.node,d=void 0!==n.parameters?n.parameters[s.input]:s.input,h=void 0!==n.parameters?n.parameters[s.output]:s.output;void 0!==r.node&&(a.push(this.getDependency("node",i)),o.push(this.getDependency("accessor",d)),l.push(this.getDependency("accessor",h)),c.push(s),u.push(r))}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l),Promise.all(c),Promise.all(u)]).then(function(e){let t=e[0],a=e[1],o=e[2],l=e[3],c=e[4],u=[];for(let e=0,r=t.length;e<r;e++){let r=t[e],n=a[e],i=o[e],d=l[e],h=c[e];if(void 0===r)continue;r.updateMatrix&&r.updateMatrix();let p=s._createAnimationTracks(r,n,i,d,h);if(p)for(let e=0;e<p.length;e++)u.push(p[e])}let d=new r.m7l(i,void 0,u);return assignExtrasToUserData(d,n),d})}createNodeMesh(e){let t=this.json,s=this,r=t.nodes[e];return void 0===r.mesh?null:s.getDependency("mesh",r.mesh).then(function(e){let t=s._getNodeRef(s.meshCache,r.mesh,e);return void 0!==r.weights&&t.traverse(function(e){if(e.isMesh)for(let t=0,s=r.weights.length;t<s;t++)e.morphTargetInfluences[t]=r.weights[t]}),t})}loadNode(e){let t=this.json,s=t.nodes[e],r=this._loadNodeShallow(e),n=[],i=s.children||[];for(let e=0,t=i.length;e<t;e++)n.push(this.getDependency("node",i[e]));let a=void 0===s.skin?Promise.resolve(null):this.getDependency("skin",s.skin);return Promise.all([r,Promise.all(n),a]).then(function(e){let t=e[0],s=e[1],r=e[2];null!==r&&t.traverse(function(e){e.isSkinnedMesh&&e.bind(r,T)});for(let e=0,r=s.length;e<r;e++)t.add(s[e]);return t})}_loadNodeShallow(e){let t=this.json,s=this.extensions,n=this;if(void 0!==this.nodeCache[e])return this.nodeCache[e];let i=t.nodes[e],a=i.name?n.createUniqueName(i.name):"",o=[],l=n._invokeOne(function(t){return t.createNodeMesh&&t.createNodeMesh(e)});return l&&o.push(l),void 0!==i.camera&&o.push(n.getDependency("camera",i.camera).then(function(e){return n._getNodeRef(n.cameraCache,i.camera,e)})),n._invokeAll(function(t){return t.createNodeAttachment&&t.createNodeAttachment(e)}).forEach(function(e){o.push(e)}),this.nodeCache[e]=Promise.all(o).then(function(t){let o;if((o=!0===i.isBone?new r.N$j:t.length>1?new r.ZAu:1===t.length?t[0]:new r.Tme)!==t[0])for(let e=0,s=t.length;e<s;e++)o.add(t[e]);if(i.name&&(o.userData.name=i.name,o.name=a),assignExtrasToUserData(o,i),i.extensions&&addUnknownExtensionsToUserData(s,o,i),void 0!==i.matrix){let e=new r.yGw;e.fromArray(i.matrix),o.applyMatrix4(e)}else void 0!==i.translation&&o.position.fromArray(i.translation),void 0!==i.rotation&&o.quaternion.fromArray(i.rotation),void 0!==i.scale&&o.scale.fromArray(i.scale);if(n.associations.has(o)){if(void 0!==i.mesh&&n.meshCache.refs[i.mesh]>1){let e=n.associations.get(o);n.associations.set(o,{...e})}}else n.associations.set(o,{});return n.associations.get(o).nodes=e,o}),this.nodeCache[e]}loadScene(e){let t=this.extensions,s=this.json.scenes[e],n=this,i=new r.ZAu;s.name&&(i.name=n.createUniqueName(s.name)),assignExtrasToUserData(i,s),s.extensions&&addUnknownExtensionsToUserData(t,i,s);let a=s.nodes||[],o=[];for(let e=0,t=a.length;e<t;e++)o.push(n.getDependency("node",a[e]));return Promise.all(o).then(function(e){for(let t=0,s=e.length;t<s;t++)i.add(e[t]);return n.associations=(e=>{let t=new Map;for(let[e,s]of n.associations)(e instanceof r.F5T||e instanceof r.xEZ)&&t.set(e,s);return e.traverse(e=>{let s=n.associations.get(e);null!=s&&t.set(e,s)}),t})(i),i})}_createAnimationTracks(e,t,s,n,i){let a;let o=[],l=e.name?e.name:e.uuid,c=[];switch(f[i.path]===f.weights?e.traverse(function(e){e.morphTargetInfluences&&c.push(e.name?e.name:e.uuid)}):c.push(l),f[i.path]){case f.weights:a=r.dUE;break;case f.rotation:a=r.iLg;break;case f.translation:case f.scale:a=r.yC1;break;default:a=1===s.itemSize?r.dUE:r.yC1}let u=void 0!==n.interpolation?m[n.interpolation]:r.NMF,d=this._getArrayFromAccessor(s);for(let e=0,s=c.length;e<s;e++){let s=new a(c[e]+"."+f[i.path],t.array,d,u);"CUBICSPLINE"===n.interpolation&&this._createCubicSplineTrackInterpolant(s),o.push(s)}return o}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){let e=getNormalizedComponentScale(t.constructor),s=new Float32Array(t.length);for(let r=0,n=t.length;r<n;r++)s[r]=t[r]*e;t=s}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(e){let t=this instanceof r.iLg?GLTFCubicSplineQuaternionInterpolant:GLTFCubicSplineInterpolant;return new t(this.times,this.values,this.getValueSize()/3,e)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}};function computeBounds(e,t,s){let n=t.attributes,i=new r.ZzF;if(void 0===n.POSITION)return;{let e=s.json.accessors[n.POSITION],t=e.min,a=e.max;if(void 0!==t&&void 0!==a){if(i.set(new r.Pa4(t[0],t[1],t[2]),new r.Pa4(a[0],a[1],a[2])),e.normalized){let t=getNormalizedComponentScale(c[e.componentType]);i.min.multiplyScalar(t),i.max.multiplyScalar(t)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}let a=t.targets;if(void 0!==a){let e=new r.Pa4,t=new r.Pa4;for(let r=0,n=a.length;r<n;r++){let n=a[r];if(void 0!==n.POSITION){let r=s.json.accessors[n.POSITION],i=r.min,a=r.max;if(void 0!==i&&void 0!==a){if(t.setX(Math.max(Math.abs(i[0]),Math.abs(a[0]))),t.setY(Math.max(Math.abs(i[1]),Math.abs(a[1]))),t.setZ(Math.max(Math.abs(i[2]),Math.abs(a[2]))),r.normalized){let e=getNormalizedComponentScale(c[r.componentType]);t.multiplyScalar(e)}e.max(t)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}i.expandByVector(e)}e.boundingBox=i;let o=new r.aLr;i.getCenter(o.center),o.radius=i.min.distanceTo(i.max)/2,e.boundingSphere=o}function addPrimitiveAttributes(e,t,s){let n=t.attributes,i=[];function assignAttributeAccessor(t,r){return s.getDependency("accessor",t).then(function(t){e.setAttribute(r,t)})}for(let t in n){let s=p[t]||t.toLowerCase();s in e.attributes||i.push(assignAttributeAccessor(n[t],s))}if(void 0!==t.indices&&!e.index){let r=s.getDependency("accessor",t.indices).then(function(t){e.setIndex(t)});i.push(r)}return r.epp.workingColorSpace!==r.GUF&&"COLOR_0"in n&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${r.epp.workingColorSpace}" not supported.`),assignExtrasToUserData(e,t),computeBounds(e,t,s),Promise.all(i).then(function(){return void 0!==t.targets?addMorphTargets(e,t.targets,s):e})}},1993:function(e,t,s){"use strict";s.d(t,{U:function(){return create}});var r=s(7294);let createStoreImpl=e=>{let t;let s=new Set,setState=(e,r)=>{let n="function"==typeof e?e(t):e;if(!Object.is(n,t)){let e=t;t=(null!=r?r:"object"!=typeof n||null===n)?n:Object.assign({},t,n),s.forEach(s=>s(t,e))}},getState=()=>t,r={setState,getState,getInitialState:()=>n,subscribe:e=>(s.add(e),()=>s.delete(e))},n=t=e(setState,getState,r);return r},createStore=e=>e?createStoreImpl(e):createStoreImpl,identity=e=>e;function useStore(e,t=identity){let s=r.useSyncExternalStore(e.subscribe,r.useCallback(()=>t(e.getState()),[e,t]),r.useCallback(()=>t(e.getInitialState()),[e,t]));return r.useDebugValue(s),s}let createImpl=e=>{let t=createStore(e),useBoundStore=e=>useStore(t,e);return Object.assign(useBoundStore,t),useBoundStore},create=e=>e?createImpl(e):createImpl}}]);