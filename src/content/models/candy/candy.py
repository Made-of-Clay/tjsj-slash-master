"""Low-poly wrapped candy from `src/content/models/candy/candy-design.jpeg`.

    blender -b -P src/content/models/candy/candy.py [-- --no-render]

An ellipsoid sweet with a two-strand wax ribbon helixed around it, and a pleated
fan wrapper pinched into each end. Solid everywhere: no transparency, flat base
colours only. Front = -Y.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
PREVIEWS = os.path.join(HERE, "previews")

BODY = {"segments": 18, "rings": 10, "rx": 0.50, "ry": 0.33, "rz": 0.40}

COLOURS = {
    "shell": "#f3a978",
    "orange": "#ef7a2c",
    "blue": "#2b7fc8",
}

# Ribbon: two parallel strands helixed around the x (wrapper) axis.
RIBBON = {
    "steps": 18,
    "turns": 1.15,
    "x": 0.425,
    "start": 0.85,
    "phase_gap": -0.30,
    "lift": 0.006,
    "strands": (("orange", 0.072, 0.050), ("blue", 0.042, 0.040)),
}

# One fan wrapper, mirrored. Rings: x, ry, rz, phase, pleat.
WRAPPER = {
    "sectors": 12,
    "rings": (
        (0.40, 0.170, 0.200, 0.00, 0.00),
        (0.50, 0.105, 0.135, 0.15, 0.00),
        (0.58, 0.115, 0.165, 0.35, 0.04),
        (0.66, 0.175, 0.245, 0.15, 0.09),
        (0.745, 0.200, 0.300, -0.15, 0.10),
        (0.800, 0.150, 0.245, -0.35, 0.06),
    ),
    "blue": 3,
}


def srgb(hex_string):
    h = hex_string.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


def finish(mesh_name, verts, faces, face_materials=None):
    mesh = bpy.data.meshes.new(mesh_name)
    mesh.from_pydata(verts, [], faces)
    if face_materials is not None:
        mesh.polygons.foreach_set("material_index", face_materials)
    mesh.validate()
    obj = bpy.data.objects.new(mesh_name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bm.calc_volume(signed=True) < 0.0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return obj


# --- body ------------------------------------------------------------------

def build_body():
    seg = BODY["segments"]
    rings = BODY["rings"]
    verts = []
    faces = []
    for j in range(1, rings):
        u = math.cos(math.pi * j / rings)
        s = math.sin(math.pi * j / rings)
        for i in range(seg):
            a = 2.0 * math.pi * i / seg
            verts.append(Vector((BODY["rx"] * u, BODY["ry"] * s * math.cos(a), BODY["rz"] * s * math.sin(a))))
    top = len(verts)
    verts.append(Vector((BODY["rx"], 0.0, 0.0)))
    bottom = len(verts)
    verts.append(Vector((-BODY["rx"], 0.0, 0.0)))

    row = lambda j: (j - 1) * seg
    for j in range(1, rings - 1):
        a, b = row(j), row(j + 1)
        for i in range(seg):
            i2 = (i + 1) % seg
            faces.append((a + i, a + i2, b + i2, b + i))
    for i in range(seg):
        i2 = (i + 1) % seg
        faces.append((top, row(1) + i, row(1) + i2))
        faces.append((bottom, row(rings - 1) + i, row(rings - 1) + i2))
    return finish("CandyBody", verts, faces)


# --- ribbon: rectangular tube riding a helix on the body surface -----------

def helix_point(x, angle):
    s = math.sqrt(max(0.0, 1.0 - (x / BODY["rx"]) ** 2))
    return Vector((x, BODY["ry"] * s * math.cos(angle), BODY["rz"] * s * math.sin(angle)))


def build_ribbon():
    steps = RIBBON["steps"]
    verts = []
    faces = []
    materials = []
    for slot, (_name, width, height) in enumerate(RIBBON["strands"]):
        base = len(verts)
        phase = RIBBON["start"] + slot * RIBBON["phase_gap"]
        for k in range(steps + 1):
            t = k / steps
            x = -RIBBON["x"] + t * 2.0 * RIBBON["x"]
            angle = phase + t * RIBBON["turns"] * 2.0 * math.pi
            p = helix_point(x, angle)
            tangent = (helix_point(x + 0.01, angle + 0.01 * RIBBON["turns"] * 2.0 * math.pi) - p).normalized()
            normal = Vector((p.x / BODY["rx"] ** 2, p.y / BODY["ry"] ** 2, p.z / BODY["rz"] ** 2)).normalized()
            edge = max(0.0, (abs(x) - 0.24) / (RIBBON["x"] - 0.24))
            half = width * 0.5 * (1.0 - 0.90 * edge**2)
            side = tangent.cross(normal).normalized() * half
            lift = RIBBON["lift"] - 0.10 * edge**4
            lo = normal * lift
            hi = normal * (lift + height * (1.0 - 0.25 * edge**2))
            verts.extend((p + lo - side, p + lo + side, p + hi + side, p + hi - side))
        for k in range(steps):
            a, b = base + 4 * k, base + 4 * (k + 1)
            for i in range(4):
                j = (i + 1) % 4
                faces.append((a + i, a + j, b + j, b + i))
                materials.append(slot)
        faces.append((base + 3, base + 2, base + 1, base))
        materials.append(slot)
        last = base + 4 * steps
        faces.append((last, last + 1, last + 2, last + 3))
        materials.append(slot)
    return finish("CandyRibbon", verts, faces, materials)


# --- wrapper: pleated fan pinched onto each end ----------------------------

def build_wrapper():
    sectors = WRAPPER["sectors"]
    rings = WRAPPER["rings"]
    verts = []
    faces = []
    materials = []
    for sign in (1.0, -1.0):
        base = len(verts)
        for x, ry, rz, phase, pleat in rings:
            for i in range(sectors):
                a = 2.0 * math.pi * i / sectors + phase
                k = 1.0 + pleat * math.cos(3.0 * a - phase * 2.0)
                verts.append(Vector((sign * x, ry * k * math.cos(a), rz * k * math.sin(a))))
        for r in range(len(rings) - 1):
            a, b = base + r * sectors, base + (r + 1) * sectors
            for i in range(sectors):
                j = (i + 1) % sectors
                faces.append((a + i, a + j, b + j, b + i))
                materials.append(1 if (i - r * 3) % sectors < WRAPPER["blue"] else 0)
        first = base
        faces.append(tuple(first + i for i in range(sectors - 1, -1, -1)))
        materials.append(0)
        last = base + (len(rings) - 1) * sectors
        faces.append(tuple(last + i for i in range(sectors)))
        materials.append(0)
    return finish("CandyWrapper", verts, faces, materials)


# --- materials, shading, scene ---------------------------------------------

def make_material(name, colour, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = srgb(colour)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def split_shading(obj, angle=42.0):
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.set_sharp_from_angle(angle=math.radians(angle))


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples = 96
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.90, 0.88, 0.85, 1.0)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.50
    scene.world = world
    for name, loc, energy, size in (
        ("Key", (-3.0, -4.5, 4.5), 420.0, 6.0),
        ("Fill", (4.5, -3.0, 0.6), 150.0, 5.0),
        ("Rim", (0.5, 4.5, 3.0), 240.0, 4.0),
    ):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        light.location = loc
        light.rotation_euler = (Vector((0.0, 0.0, 0.0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(light)


def render_views():
    os.makedirs(PREVIEWS, exist_ok=True)
    scene = bpy.context.scene
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.image_settings.file_format = "PNG"
    camera_data = bpy.data.cameras.new("PreviewCam")
    camera = bpy.data.objects.new("PreviewCam", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera

    target = Vector((0.0, 0.0, 0.0))
    views = {
        "front": ((0.0, -7.0, 0.0), "ORTHO"),
        "side": ((7.0, 0.0, 0.0), "ORTHO"),
        "top": ((0.0, 0.0, 7.0), "ORTHO"),
        "hero": ((3.0, -5.2, 1.6), "PERSP"),
    }
    for name, (loc, kind) in views.items():
        camera_data.type = kind
        camera_data.ortho_scale = 1.9
        camera_data.lens = 72.0
        camera.location = loc
        if name == "top":
            camera.rotation_euler = (0.0, 0.0, 0.0)
        else:
            camera.rotation_euler = (target - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(PREVIEWS, f"{name}.png")
        bpy.ops.render.render(write_still=True)


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def main():
    setup_scene()
    make_material("CandyShell", COLOURS["shell"], 0.32)
    make_material("CandyWaxOrange", COLOURS["orange"], 0.48)
    make_material("CandyWaxBlue", COLOURS["blue"], 0.48)

    body = build_body()
    body.data.materials.append(bpy.data.materials["CandyShell"])
    ribbon = build_ribbon()
    ribbon.data.materials.append(bpy.data.materials["CandyWaxOrange"])
    ribbon.data.materials.append(bpy.data.materials["CandyWaxBlue"])
    wrapper = build_wrapper()
    wrapper.data.materials.append(bpy.data.materials["CandyWaxOrange"])
    wrapper.data.materials.append(bpy.data.materials["CandyWaxBlue"])

    for obj in (body, ribbon, wrapper):
        split_shading(obj)

    counts = [tri_count(o) for o in bpy.data.objects if o.type == "MESH"]
    print(f"TRIS per-object={counts} total={sum(counts)}")

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "candy.blend"))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(HERE, "candy.glb"),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
    if "--no-render" not in sys.argv:
        render_views()


main()
