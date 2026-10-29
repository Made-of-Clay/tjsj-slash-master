"""Low-poly cartoon skull from `src/content/models/skull/skull-design.jpeg`.

    blender -b -P src/content/models/skull/skull.py [-- --no-render]

The cranium is one solid superellipsoid: two eye sockets and a nose are boolean
pockets with dark floors, and four teeth hang off the jaw as separate prisms
whose tops are buried above the gum line. Front = -Y.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
PREVIEWS = os.path.join(HERE, "previews")

BODY = {
    "segments": 32,
    "rings": 10,
    "rx": 1.0,
    "ry": 0.86,
    "rz_top": 0.84,
    "rz_bot": 0.70,
    "profile": 2.3,
    "ring": 2.3,
    "front_taper": 0.12,
    "front_flatten": 0.90,
    "brow": 0.075,
    "brow_z": 0.44,
    "brow_w": 0.14,
    "face_push": 0.13,
    "face_top": 0.10,
    "face_fall": 0.45,
    "jaw": 0.18,
    "jaw_top": 0.48,
    "jaw_fall": 0.32,
    "bottom_shift": 0.20,
}

COLOURS = {
    "bone": "#e7dbc2",
    "cavity": "#6f5a47",
    "socket": "#33261f",
    "teeth": "#fbf5e6",
}

EYE = {"rx": 0.275, "rz": 0.24, "power": 2.3, "steps": 16, "x": 0.48, "z": 0.075}
EYE_DEPTH = 0.14
EYE_INSET = 0.86

NOSE_DEPTH = 0.09
NOSE_INSET = 0.90

TOOTH = {
    "width": 0.215,
    "round": 0.107,
    "z_top": -0.42,
    "z_bot": -0.75,
    "proud": 0.085,
    "set": 0.03,
    "depth": 0.10,
    "flare": 0.014,
    "xs": (0.1225, 0.3675),
}


def srgb(hex_string):
    h = hex_string.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def smoothstep(t):
    t = clamp(t)
    return t * t * (3.0 - 2.0 * t)


def gauss(u, centre, width):
    return math.exp(-(((u - centre) / width) ** 2))


def body_vertex(phi, u):
    r = max(0.0, 1.0 - abs(u) ** BODY["profile"]) ** (1.0 / BODY["profile"])
    jaw = 1.0 - BODY["jaw"] * smoothstep((-u - BODY["jaw_top"]) / BODY["jaw_fall"])
    taper = 1.0 - BODY["front_taper"] * (0.5 + 0.5 * math.cos(phi))
    ring = 2.0 / BODY["ring"]
    sin_p = math.copysign(abs(math.sin(phi)) ** ring, math.sin(phi))
    cos_p = math.copysign(abs(math.cos(phi)) ** ring, math.cos(phi))
    x = BODY["rx"] * r * jaw * taper * sin_p
    y = -BODY["ry"] * r * cos_p
    z = (BODY["rz_top"] if u >= 0.0 else BODY["rz_bot"]) * u

    front = max(0.0, math.cos(phi)) ** 2
    if y < 0.0:
        y *= BODY["front_flatten"]
        y -= BODY["brow"] * gauss(u, BODY["brow_z"], BODY["brow_w"]) * front
        y -= BODY["face_push"] * smoothstep((-u - BODY["face_top"]) / BODY["face_fall"]) * front
    y -= BODY["bottom_shift"] * smoothstep((-u - 0.35) / 0.65)
    return Vector((x, y, z))


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


def build_body():
    seg = BODY["segments"]
    rings = BODY["rings"]
    verts = []
    faces = []
    for j in range(1, rings):
        u = math.cos(math.pi * j / rings)
        for i in range(seg):
            verts.append(body_vertex(2.0 * math.pi * i / seg, u))
    top = len(verts)
    verts.append(body_vertex(0.0, 1.0))
    bottom = len(verts)
    verts.append(body_vertex(0.0, -1.0))

    row = lambda j: (j - 1) * seg
    for j in range(1, rings - 1):
        a = row(j)
        b = row(j + 1)
        for i in range(seg):
            i2 = (i + 1) % seg
            faces.append((a + i, a + i2, b + i2, b + i))
    for i in range(seg):
        i2 = (i + 1) % seg
        faces.append((top, row(1) + i, row(1) + i2))
        faces.append((bottom, row(rings - 1) + i, row(rings - 1) + i2))
    return finish("SkullBody", verts, faces)


def sphere_bvh(obj):
    return BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())


# --- face features, authored in the front (x, z) plane ----------------------

def squircle(cx, cz, rx, rz, power, steps):
    """Superellipse outline: power 2 is an ellipse, higher is boxier."""
    pts = []
    for i in range(steps):
        a = 2.0 * math.pi * i / steps
        c, s = math.cos(a), math.sin(a)
        pts.append((
            cx + rx * math.copysign(abs(c) ** (2.0 / power), c),
            cz + rz * math.copysign(abs(s) ** (2.0 / power), s),
        ))
    return pts


def nose_path():
    """Inverted pear: rounded apex up, widest low, notched between two lobes."""
    return [
        (0.020, -0.172),
        (0.062, -0.208),
        (0.118, -0.270),
        (0.150, -0.340),
        (0.140, -0.400),
        (0.075, -0.432),
        (0.030, -0.398),
        (0.006, -0.391),
        (-0.006, -0.391),
        (-0.030, -0.398),
        (-0.075, -0.432),
        (-0.140, -0.400),
        (-0.150, -0.340),
        (-0.118, -0.270),
        (-0.062, -0.208),
        (-0.020, -0.172),
    ]


def transform_path(points, scale, offset, mirror=1.0):
    return [(x * scale[0] * mirror + offset[0], z * scale[1] + offset[1]) for x, z in points]


# --- cutter: straight prism through the shell, floor rides the shell -------

def surface(frame, x, z):
    hit, normal, _index, _dist = frame.ray_cast(Vector((x, -6.0, z)), Vector((0.0, 1.0, 0.0)))
    if hit is None:
        raise RuntimeError(f"feature point ({x:.3f}, {z:.3f}) misses the body")
    return hit, normal


def area2(poly):
    total = 0.0
    for i in range(len(poly)):
        x1, z1 = poly[i]
        x2, z2 = poly[(i + 1) % len(poly)]
        total += x1 * z2 - x2 * z1
    return total * 0.5


def point_in_triangle(p, a, b, c):
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

    d1, d2, d3 = sign(p, a, b), sign(p, b, c), sign(p, c, a)
    neg = d1 < -1e-9 or d2 < -1e-9 or d3 < -1e-9
    pos = d1 > 1e-9 or d2 > 1e-9 or d3 > 1e-9
    return not (neg and pos)


def triangulate_2d(poly):
    """Ear clipping; a centroid fan folds over concave paths."""
    order = list(range(len(poly)))
    if area2(poly) < 0.0:
        order.reverse()
    tris = []

    def cross(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    while len(order) > 3:
        for k in range(len(order)):
            i0, i1, i2 = order[k - 1], order[k], order[(k + 1) % len(order)]
            a, b, c = poly[i0], poly[i1], poly[i2]
            if cross(a, b, c) <= 1e-9:
                continue
            if any(point_in_triangle(poly[j], a, b, c) for j in order if j not in (i0, i1, i2)):
                continue
            tris.append((i0, i1, i2))
            order.pop(k)
            break
        else:
            raise RuntimeError("feature path is self-intersecting")
    tris.append(tuple(order))
    return tris


def build_cutter(name, path, frame, depth, inset, margin=0.005):
    """Three rings: far outside, the authored opening, and a beveled floor that
    follows the shell. The pocket rim lands on the drawn outline."""
    ys = [surface(frame, x, z)[0].y for x, z in path]
    count = len(path)
    cx = sum(px for px, _pz in path) / count
    cz = sum(pz for _px, pz in path) / count
    inner = [(cx + (x - cx) * inset, cz + (z - cz) * inset) for x, z in path]

    far = [(x, ys[i] - 0.5, z) for i, (x, z) in enumerate(path)]
    rim = [(x, ys[i] - margin, z) for i, (x, z) in enumerate(path)]
    floor = [(x, surface(frame, x, z)[0].y + depth, z) for x, z in inner]
    verts = far + rim + floor

    faces = []
    materials = []
    for ring in (0, count):
        for i in range(count):
            j = (i + 1) % count
            faces.append((ring + i, ring + j, ring + count + j, ring + count + i))
            materials.append(0)
    for a, b, c in triangulate_2d(path):
        faces.append((a, c, b))
        materials.append(0)
        faces.append((2 * count + a, 2 * count + b, 2 * count + c))
        materials.append(1)

    cutter = finish(name, verts, faces, materials)
    cutter.data.materials.append(bpy.data.materials["SkullCavity"])
    cutter.data.materials.append(bpy.data.materials["SkullSocket"])
    return cutter


# --- teeth: rounded tabs hung off the jaw, no boolean ----------------------

def tooth_outline(width, height, radius):
    """Pill: flat top buried in the jaw, barrel flanks, rounded chewing end."""
    hw, hh = width * 0.5, height * 0.5
    r = min(radius, hw)
    belly = hw + 0.014
    return [
        (hw, hh),
        (belly, 0.0),
        (hw, -hh + r),
        (hw * 0.72, -hh),
        (0.0, -hh),
        (-hw * 0.72, -hh),
        (-hw, -hh + r),
        (-belly, 0.0),
        (-hw, hh),
    ]


LATERAL = ((0, 1), (6, 7))


def build_teeth(name, frame):
    """Tabs hung off the jaw: the top ring is buried behind the bone surface and
    the front leans out as it drops, so each tooth grows out of the jaw. The
    back ring flares so neighbours overlap, closing the creases between them."""
    height = TOOTH["z_top"] - TOOTH["z_bot"]
    outline = tooth_outline(TOOTH["width"], height, TOOTH["round"])
    z_mid = (TOOTH["z_top"] + TOOTH["z_bot"]) * 0.5
    verts = []
    faces = []
    materials = []
    for mirror in (1.0, -1.0):
        for x0 in TOOTH["xs"]:
            base = len(verts)
            for x, dz in outline:
                z = z_mid + dz
                t = (TOOTH["z_top"] - z) / height
                xw = (x0 + x) * mirror
                gum = surface(frame, xw, TOOTH["z_top"])[0].y
                verts.append(Vector((xw, gum + TOOTH["set"] - (TOOTH["set"] + TOOTH["proud"]) * t, z)))
            for x, dz in outline:
                wide = x + math.copysign(TOOTH["flare"], x)
                xw = (x0 + wide) * mirror
                gum = surface(frame, xw, TOOTH["z_top"])[0].y
                verts.append(Vector((xw, gum + TOOTH["depth"], z_mid + dz * 0.7)))
            count = len(outline)
            for a, b, c in triangulate_2d(outline):
                faces.append((base + a, base + b, base + c))
                materials.append(0)
                faces.append((base + count + a, base + count + c, base + count + b))
                materials.append(0)
            dark = LATERAL if x0 < TOOTH["xs"][-1] else LATERAL[1:]
            for i in range(count):
                j = (i + 1) % count
                faces.append((base + i, base + count + i, base + count + j, base + j))
                materials.append(1 if any(i in pair for pair in dark) else 0)
    return finish(name, verts, faces, materials)


# --- materials, shading, scene ---------------------------------------------

def make_material(name, colour, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = srgb(colour)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def split_shading(obj, angle=38.0):
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
        light.rotation_euler = (Vector((0.0, 0.0, 0.1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
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

    target = Vector((0.0, 0.0, 0.05))
    views = {
        "front": ((0.0, -7.0, 0.05), "ORTHO", 2.5),
        "side": ((7.0, 0.0, 0.05), "ORTHO", 2.5),
        "top": ((0.0, 0.0, 7.0), "ORTHO", 2.5),
        "hero": ((3.2, -5.4, 1.0), "PERSP", 0.0),
    }
    for name, (loc, kind, ortho) in views.items():
        camera_data.type = kind
        camera_data.ortho_scale = ortho
        camera_data.lens = 70.0
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
    for name, colour, rough in (
        ("SkullBone", COLOURS["bone"], 0.58),
        ("SkullCavity", COLOURS["cavity"], 0.66),
        ("SkullSocket", COLOURS["socket"], 0.85),
        ("SkullTeeth", COLOURS["teeth"], 0.38),
    ):
        make_material(name, colour, rough)

    body = build_body()
    for name in ("SkullBone", "SkullCavity", "SkullSocket"):
        body.data.materials.append(bpy.data.materials[name])
    frame = sphere_bvh(body)

    eye = squircle(0.0, 0.0, EYE["rx"], EYE["rz"], EYE["power"], EYE["steps"])
    features = (
        (transform_path(eye, (1.0, 1.0), (-EYE["x"], EYE["z"]), 1.0), EYE_DEPTH, EYE_INSET),
        (transform_path(eye, (1.0, 1.0), (EYE["x"], EYE["z"]), -1.0), EYE_DEPTH, EYE_INSET),
        (nose_path(), NOSE_DEPTH, NOSE_INSET),
    )
    for index, (path, depth, inset) in enumerate(features):
        cutter = build_cutter(f"Cut{index}", path, frame, depth, inset)
        mod = body.modifiers.new(f"Cut{index}", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = cutter
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)

    split_shading(body, 38.0)

    bpy.context.view_layer.update()
    teeth = build_teeth("SkullTeeth", sphere_bvh(body))
    teeth.data.materials.append(bpy.data.materials["SkullTeeth"])
    teeth.data.materials.append(bpy.data.materials["SkullCavity"])
    split_shading(teeth, 46.0)

    counts = [tri_count(o) for o in bpy.data.objects if o.type == "MESH"]
    print(f"TRIS per-object={counts} total={sum(counts)}")

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "skull.blend"))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(HERE, "skull.glb"),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
    if "--no-render" not in sys.argv:
        render_views()


main()
