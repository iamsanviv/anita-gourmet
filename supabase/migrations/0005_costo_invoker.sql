-- product_cost no necesita privilegios elevados: el personal ya puede leer recetas e inventario.
alter function public.product_cost(uuid) security invoker;
