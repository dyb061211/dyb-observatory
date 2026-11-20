export function program(gl,vertex,fragment) {
  const out=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source); gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(out,shader); gl.deleteShader(shader);
  }
  gl.linkProgram(out);
  if(!gl.getProgramParameter(out,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(out));
  const attr={},u={};
  for(let i=0;i<gl.getProgramParameter(out,gl.ACTIVE_ATTRIBUTES);i++){const name=gl.getActiveAttrib(out,i).name;attr[name]=gl.getAttribLocation(out,name);}
  for(let i=0;i<gl.getProgramParameter(out,gl.ACTIVE_UNIFORMS);i++){const name=gl.getActiveUniform(out,i).name;u[name]=gl.getUniformLocation(out,name);}
  return {out,attr,u};
}
