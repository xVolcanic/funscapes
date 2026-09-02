import * as THREE from "three";

export interface ParkAnimator {
  update(t: number, dt: number): void;
}

function findAll(root: THREE.Object3D, test: RegExp) {
  const matches: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (test.test(object.name)) matches.push(object);
  });
  return matches;
}

function ferrisWheel(model: THREE.Object3D): ParkAnimator | null {
  const wheel = model.getObjectByName("Eye_of_Kenya");
  const rotor = wheel?.getObjectByName("wheel_rotor");
  if (!wheel || !rotor) return null;

  const baseZ = rotor.rotation.z;
  const cabins = findAll(wheel, /^cabin_pivot_\d+$/).map((cabin) => ({
    cabin,
    baseZ: cabin.rotation.z,
  }));
  let phase = 0;

  return {
    update(_t, dt) {
      phase += dt * 0.085;
      rotor.rotation.z = baseZ + phase;
      cabins.forEach(({ cabin, baseZ: cabinBaseZ }) => {
        cabin.rotation.z = cabinBaseZ - phase;
      });
    },
  };
}

function carousel(model: THREE.Object3D): ParkAnimator | null {
  const ride = model.getObjectByName("Carousel");
  const rotor = ride?.getObjectByName("rotor");
  if (!rotor) return null;

  const baseY = rotor.rotation.y;
  const horses = findAll(rotor, /^horse_\d+$/).map((horse, index) => ({
    horse,
    baseY: horse.position.y,
    phase: index * 1.1,
  }));

  return {
    update(t) {
      rotor.rotation.y = baseY + t * 0.38;
      horses.forEach(({ horse, baseY: horseBaseY, phase }) => {
        horse.position.y = horseBaseY + Math.sin(t * 2.15 + phase) * 0.12;
      });
    },
  };
}

function teacups(model: THREE.Object3D): ParkAnimator | null {
  const ride = model.getObjectByName("Teacups");
  const rotor = ride?.getObjectByName("teacup_rotor");
  if (!rotor) return null;

  const rotorBaseY = rotor.rotation.y;
  const cups = findAll(rotor, /^teacup_pivot_\d+$/).map((cup, index) => ({
    cup,
    baseY: cup.rotation.y,
    direction: index % 2 === 0 ? 1 : -1,
    speed: 0.72 + (index % 3) * 0.08,
  }));

  return {
    update(t) {
      rotor.rotation.y = rotorBaseY + t * 0.3;
      cups.forEach(({ cup, baseY, direction, speed }) => {
        cup.rotation.y = baseY + t * speed * direction;
      });
    },
  };
}

function dropTower(model: THREE.Object3D): ParkAnimator | null {
  const tower = model.getObjectByName("Drop_tower");
  const car = tower?.getObjectByName("drop_car");
  const crown = tower?.getObjectByName("crown_deck");
  if (!tower || !car) return null;

  // The exported snapshot may catch the car halfway through its cycle. Reset it
  // to the authored base before measuring the safe travel distance.
  car.position.y = 0;
  tower.updateMatrixWorld(true);
  const carBox = new THREE.Box3().setFromObject(car);
  const towerBox = new THREE.Box3().setFromObject(tower);
  const crownBox = crown ? new THREE.Box3().setFromObject(crown) : null;
  const parentScale = car.parent?.getWorldScale(new THREE.Vector3()) ?? new THREE.Vector3(1, 1, 1);
  const worldTravel = (crownBox?.min.y ?? towerBox.max.y) - carBox.max.y - 0.025;
  const travel = Math.max(0, worldTravel / Math.max(parentScale.y, 0.0001));
  const cycle = 12.75;

  return {
    update(t) {
      const step = t % cycle;
      let y = 0;
      if (step < 6) {
        const amount = step / 6;
        y = travel * (1 - Math.pow(1 - amount, 2));
      } else if (step < 8) {
        y = travel;
      } else if (step < 8.75) {
        const amount = (step - 8) / 0.75;
        y = travel * (1 - amount * amount);
      } else if (step < 10.25) {
        const amount = (step - 8.75) / 1.5;
        y = Math.abs(Math.sin(amount * Math.PI * 2)) * travel * 0.08 * (1 - amount);
      }
      car.position.y = y;
    },
  };
}

function bumperCars(model: THREE.Object3D): ParkAnimator | null {
  const pavilion = model.getObjectByName("Bumper_cars");
  if (!pavilion) return null;

  const cars = findAll(pavilion, /^bumper_car_\d+$/).map((car, index) => ({
    car,
    x: car.position.x,
    z: car.position.z,
    rotationY: car.rotation.y,
    phase: index * 0.9,
    radius: 0.5 + (index % 3) * 0.25,
  }));
  if (!cars.length) return null;

  return {
    update(t) {
      cars.forEach(({ car, x, z, rotationY, phase, radius }) => {
        car.position.x = x + Math.cos(t * 0.7 + phase) * radius;
        car.position.z = z + Math.sin(t * 0.9 + phase) * radius;
        car.rotation.y = rotationY + Math.sin(t * 0.5 + phase) * 0.8;
      });
    },
  };
}

function balloons(model: THREE.Object3D): ParkAnimator | null {
  const group = model.getObjectByName("balloons");
  if (!group?.children.length) return null;

  const items = group.children.map((balloon, index) => ({
    balloon,
    x: balloon.position.x,
    y: balloon.position.y,
    rotationZ: balloon.rotation.z,
    phase: [0, 2.1, 4.2, 1.2][index] ?? index * 1.4,
  }));

  return {
    update(t) {
      items.forEach(({ balloon, x, y, rotationZ, phase }) => {
        balloon.position.y = y + Math.sin(t * 0.35 + phase) * 1.6;
        balloon.position.x = x + Math.sin(t * 0.18 + phase) * 3;
        balloon.rotation.z = rotationZ + Math.sin(t * 0.3 + phase) * 0.04;
      });
    },
  };
}

/** Recreates the authored park loops on the combined hero export. */
export function createHeroParkMotion(model: THREE.Object3D): ParkAnimator {
  const animators = [
    ferrisWheel(model),
    teacups(model),
    dropTower(model),
    carousel(model),
    bumperCars(model),
    balloons(model),
  ].filter((animator): animator is ParkAnimator => animator !== null);

  return {
    update(t, dt) {
      animators.forEach((animator) => animator.update(t, dt));
    },
  };
}
