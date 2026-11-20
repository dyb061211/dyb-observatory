"""Bake a Schwarzschild null-ray table and a periodic accretion-disk material."""
from pathlib import Path

import numpy as np
from PIL import Image

DEST = Path(__file__).resolve().parents[1] / "public/assets/sky"


def bake_rays():
    # u=M/r, u''=3u²-u. A ray arrives from infinity with du/dphi=M/b.
    width, height = 1280, 512
    impact = np.linspace(0.012, 32.0, width)
    u = np.zeros(width)
    velocity = 1.0 / impact
    live = np.ones(width, dtype=bool)
    table = np.zeros((height, width, 3), dtype=np.uint8)
    step = 2 * np.pi / ((height - 1) * 3)

    def acceleration(inverse_radius):
        return 3 * inverse_radius**2 - inverse_radius

    for row in range(height):
        packed = np.rint(np.clip(u * 2, 0, 1) * 65535).astype(np.uint16)
        table[row, :, 0] = packed >> 8
        table[row, :, 1] = packed & 255
        for _ in range(3):
            a = acceleration(u)
            v2 = velocity + step * a / 2
            a2 = acceleration(u + step * velocity / 2)
            v3 = velocity + step * a2 / 2
            a3 = acceleration(u + step * v2 / 2)
            v4 = velocity + step * a3
            a4 = acceleration(u + step * v3)
            u[live] += step / 6 * (velocity + 2 * v2 + 2 * v3 + v4)[live]
            velocity[live] += step / 6 * (a + 2 * a2 + 2 * a3 + a4)[live]
            live &= (u < .5) & (u >= 0)
            np.clip(u, 0, .5, out=u)
            velocity[~live] = 0
    Image.fromarray(table).save(DEST / "horizon-rays.png", optimize=True)


def bake_material():
    rng = np.random.default_rng(54671)
    y, x = np.mgrid[0:512, 0:1024]
    azimuth, radius = x / 1024, y / 511

    def noise(u, v, around, across):
        grid = rng.random((across, around))
        s, t = u * around, v * across
        i, j = np.floor(s).astype(int), np.floor(t).astype(int)
        a, b = s - i, t - j
        a, b = a*a*(3-2*a), b*b*(3-2*b)
        sample = lambda dx, dy: grid[(j+dy) % across, (i+dx) % around]
        return (sample(0,0)*(1-a)+sample(1,0)*a)*(1-b) + (sample(0,1)*(1-a)+sample(1,1)*a)*b

    # Stretch eddies along the orbit. The domain wraps at one turn.
    q = radius + .10*(noise(azimuth, radius, 6, 5)-.5) + .047*np.sin(2*np.pi*(azimuth*2+radius*1.3))
    p = azimuth + .095*np.sin(2*np.pi*(radius*1.7-azimuth)) + .10*(noise(azimuth, q, 6, 8)-.5)
    q += .041*(noise(p, q, 12, 18)-.5) + .016*(noise(p, q, 26, 41)-.5)
    mass = .51*noise(p, q, 6, 11) + .31*noise(p, q, 15, 30) + .18*noise(p, q, 39, 74)
    ridges = 1 - np.abs(2*noise(p, q, 18, 62)-1)
    fibers = .48*ridges**3 + .32*noise(p, q, 45, 140) + .20*noise(p, q, 96, 240)
    # Narrow thermal fronts trail off in the direction opposite the flow.
    # Wrap distance around the disk so an eddy can cross the seam intact.
    fronts = np.zeros_like(mass)
    for _ in range(120):
        u, v = rng.random(2)
        dx = (azimuth-u+.5) % 1 - .5
        length, thickness = rng.uniform(.013,.055), rng.uniform(.002,.014)
        dy = q-v + dx*rng.uniform(-.8,.8) + .22*dx*np.sin(dx*80)
        along = np.where(dx>0, dx/(length*.20), -dx/length)
        fronts += rng.uniform(.48,1.2)*np.exp(-along-.5*(dy/thickness)**2)
    fronts = np.clip(fronts*(.55+.8*fibers),0,1)
    material = np.stack((np.clip(.5+(mass-.5)*1.75,0,1), fibers, fronts), axis=-1)
    Image.fromarray(np.uint8(np.rint(material*255))).save(DEST / "horizon-plasma.webp", quality=95, method=6)


if __name__ == "__main__":
    bake_rays()
    bake_material()
